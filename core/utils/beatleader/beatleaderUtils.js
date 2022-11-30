const Bottleneck = require(`bottleneck`)
const fetch = require('node-fetch')

const limiter = new Bottleneck({
    reservoir: 350,
    reservoirRefreshAmount: 350,
    reservoirRefreshInterval: 1000 * 60,

    minTime: 25
})

limiter.on("failed", async (error, jobInfo) => {
    const id = jobInfo.options.id
    console.warn(`Job ${id} failed: ${error}`)

    if (jobInfo.retryCount < 2) {
        console.log(`Retrying job ${id} in ${(jobInfo.retryCount + 1) * 250}ms`)
        return 250 * (jobInfo.retryCount + 1)
    } else if (jobInfo.retryCount === 2) {
        console.log(`Retrying job ${id} in 1 minute.`)
        return 1000 * 60
    }
})

limiter.on("retry", (jobInfo) => console.log(`Retrying ${jobInfo.options.id}.`))

class BeatLeaderUtils {
    constructor(db, config, client) {
        this.db = db
        this.config = config
        this.client = client
    }

    async getUser(beatLeaderId) {
        try {
            let executions = 0
            const user = await limiter.schedule({ id: `User: ${beatLeaderId}`}, async () => {
                executions++
                const response = await fetch()
                    .then(response => response.json(`https://api.beatleader.xyz/swagger/v1/player/${beatLeaderId}`))
                    .catch(error => { throw new Error(error)})
                    
                if (response != null)
                    return response

                if (executions > 3)
                    return null
            })
            return user
        } catch(error) {
            console.log(`Had an error: ${err} with fetching user with Beat Leader ID: ${beatLeaderId}`)
            return null
        }
    }

    async addPlayToDb(playData, user) {
        const isRanked = (playData.score.pp > 0)

        const play = {
            leaderboardId: playData.leaderboard.id,
            score: playData.score.baseScore,
            hash: playData.leaderboard.songHash.toUpperCase(),
            maxscore: 0,
            player: user.id,
            country: user.country,
            diff: playData.leaderboard.difficulty.difficultyRaw,
            diffInt: playData.leaderboard.difficulty.difficulty,
            date: new Date(playData.score.timeSet).getTime(),
            ranked: isRanked,
            misses: playData.score.missedNotes,
            badCut: playData.score.badCuts,
            fc: playData.score.fullCombo,
            pp: playData.score.pp,
            gained: false
        }

        await this.db.collection("beatLeaderScores").replaceOne({ hash: play.hash, player: play.player, diff: play.diff }, play, { upsert: true })
    }

    async getRecentScores(beatLeaderId) {
        let foundSeenPlay = false
        let pageOfBeatLeader = 1

        const dbresLatestScore = await this.db.collection("beatLeaderScores").find({ player: beatLeaderId }).sort({ date: -1 }).limit(1).toArray();
        let userChecked = false;
        let user = { id: beatLeaderId, country: "" }

        while (!foundSeenPlay) {
            let executions = 0
            const scores = await limiter.schedule({ id: `Recent ${beatLeaderId} page: ${pageOfScoreSaber}` }, async () => {
                executions++
                const response = await fetch(`https://api.beatleader.xyz/swagger/v1/player/${beatLeaderId}/scores?count=50&iorder=desc&page=${pageOfBeatLeader}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) })
                if (executions > 3) {
                    console.log(`Failed multiple times to get scores from ${beatLeaderId} page: ${pageOfScoreSaber}.`)
                    throw new Error(err)
                }
                else {
                    for (let i = 0; i < response.playerScores?.length; i++) {
                        if (new Date(response.playerScores[i].score.timeSet).getTime() <= new Date(dbresLatestScore[0].date).getTime()) {
                            foundSeenPlay = true
                            break
                        }
                        else {
                            if (!userChecked) {
                                const dbUser = await this.client.db.collection("beatLeaderScores").findOne({ blId: beatLeaderId })
                                if (dbUser) {
                                    user.country = dbUser.country
                                }
                                else {
                                    const tmpUser = await this.getUser(beatLeaderId)
                                    user.country = tmpUser.country
                                }
                                userChecked = true
                            }
                        }
                    }
                }
            })
            pageOfBeatLeader++
        }
        console.log(`Reached end of unseen plays for ${beatLeaderId} from recent.`)
    }

    async getAllScores(beatLeaderId) {
        let pageOfBeatLeader = 1
        let reachedLastPage = false
        let totalScores = 0
        let userChecked = false
        let user = { id: beatLeaderId, country: "" }

        while (!reachedLastPage) {
            let executions = 0;
            const scores = await limiter.schedule({ id: `Recent ${beatLeaderId} page: ${pageOfBeatLeader}` }, async () => {
                executions++;
                const res = await fetch(`https://api.beatleader.xyz/swagger/v1/player/${beatLeaderId}/scores?count=100&sort=desc&page=${pageOfBeatLeader}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) })

                if (executions === 3) console.log(`Failed multiple times to get scores from ${beatLeaderId} page: ${pageOfBeatLeader}.`)
                else {
                    if (!userChecked) {
                        const dbUser = await this.client.db.collection("beatLeaderScores").findOne({ blId: beatLeaderId })
                        if (dbUser) {
                            user.country = dbUser.country
                        }
                        else {
                            const tmpUser = await this.getUser(beatLeaderId)
                            user.country = tmpUser.country
                        }
                        userChecked = true
                    }
                    for (let i = 0; i < res.playerScores.length; i++) {
                        totalScores++
                        await this.addPlayToDb(res.playerScores[i], user)
                    }
                    if (res?.playerScores?.length === 100) pageOfBeatLeader++
                    else reachedLastPage = true
                }

            });
        }
        console.log(`Reached last page of scores for ${beatLeaderId}. Total scores: ${totalScores} on a total of ${pageOfBeatLeader} pages.`)
    }

    async scoreTracker() {
        const users = await this.db.collection("beatLeaderScores").distinct("player")
        let usersUpdated = 0
        for (let i = 0; i < users.length; i++) {
            const latestScore = await this.db.collection("beatLeaderScores").find({ player: users[i] }).sort({ date: -1 }).limit(1).toArray()
            if (latestScore[0].date < (Date.now() - 86400000)) {
                //Add check here with apicheck with 1 score, if it's not the same as the most recent in db, do the recent search
                await this.getRecentScores(users[i])
                usersUpdated++
            }
        }
        console.log(`Updated scores for ${usersUpdated} users`)
    }
} 
module.exports = BeatLeaderUtils