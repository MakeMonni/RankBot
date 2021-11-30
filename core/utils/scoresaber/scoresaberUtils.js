const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const limiter = new Bottleneck({
    reservoir: 70,
    reservoirRefreshAmount: 70,
    //Millisecond - Second - Minutes
    reservoirRefreshInterval: 1000 * 60,

    minTime: 25
});

limiter.on("failed", async (error, jobInfo) => {
    const id = jobInfo.options.id;
    console.warn(`Job ${id} failed: ${error}`);

    if (jobInfo.retryCount < 2) {
        console.log(`Retrying job ${id} in ${(jobInfo.retryCount + 1) * 250}ms`);
        return 250 * (jobInfo.retryCount + 1);
    } else if (jobInfo.retryCount === 2) {
        console.log(`Retrying job ${id} in 1 minute.`)
        return 1000 * 60
    }
});

limiter.on("retry", (jobInfo) => console.log(`Retrying ${jobInfo.options.id}.`));

class ScoreSaberUtils {
    constructor(db, config, client) {
        this.db = db;
        this.config = config;
        this.client = client;
    }

    async getUser(scoreSaberID) {
        try {
            let executions = 0;
            const user = await limiter.schedule({ id: `User ${scoreSaberID}` }, async () => {
                executions++;
                const response = await fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/full`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });

                if (response != null)
                    return response;

                if (executions > 3)
                    return null;
            });
            return user;
        } catch (err) {
            console.log(`Had an error: ${err} with scID:${scoreSaberID}`);
            return null
        }
    }

    async updateRole(scoresaberId, discordUsername, discordId, nolog) {
        const scUser = await this.getUser(scoresaberId);
        const guild = await this.client.guilds.fetch(this.config.guildId);

        try {
            const member = await guild.members.fetch({ user: discordId, force: true });
            if (!member) {
                console.log(`Database contained user ${discordUsername} [${discordId}] that could not be updated`);
                throw new Error("Failed to fetch guild member");
            }

            let playerRank = scUser.playerInfo.countryRank;
            let memberRoles = member.roles.cache.array().filter(role => !role.name.startsWith("Top"));

            if (scUser.playerInfo.countryRank === 0) playerRank = -1;

            if (!playerRank) {
                console.log(`There was an error with this user, most likely an API error, user: ${discordUsername} sc:${scoresaberId}`)
            }

            let inactive = false;
            let addRole = null;

            if (playerRank === -1) {
                if (!nolog) console.log(`${discordUsername} seems to be inactive according to scoresaber, removing Top role.`);

                inactive = true;
            } else if (playerRank <= 5) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 5").first();
            } else if (playerRank <= 10) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 10").first();
            } else if (playerRank <= 15) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 15").first();
            } else if (playerRank <= 20) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 20").first();
            } else if (playerRank <= 25) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 25").first();
            } else if (playerRank <= 50) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 50").first();
            } else if (playerRank > 50) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 50+").first();
            }

            if (!inactive) {
                if (!nolog) {
                    console.log(`Adding role ${addRole.name} to user ${discordUsername}.`);
                }
                memberRoles.push(addRole);
            }
            
            member.roles.set(memberRoles);
        } catch (err) {
            console.log(`Failed to automaticly update role for user: ${discordUsername}. Reason: ${err}, scID: ${scoresaberId}`);
            throw err;
        }
    }

    async updateAllRoles() {
        try {
            console.time("RoleUpdates")
            const dbres = await this.client.db.collection("discordRankBotUsers").find({ country: this.config.country }).toArray();
            console.log(`Starting role updates with ${dbres.length} users to update.`);

            let promises = [];
            for (let i = 0; i < dbres.length; i++) {
                const user = this.client.scoresaber.getUser(dbres[i].scId);
                promises.push(user);
            }
            const responses = await Promise.all(promises);

            for (let i = 0; i < dbres.length; i++) {
                try {
                    await this.client.scoresaber.updateRole(dbres[i].scId, dbres[i].discName, dbres[i].discId, true);
                }
                catch {
                    console.log(`Failed to update role for ${dbres[i].discName}, scId: ${dbres[i].scId} discId: ${dbres[i].discId}`);
                    continue;
                }
            }
            console.log(`Completed role updates.`);
            console.timeEnd("RoleUpdates")
        }
        catch (err) {
            console.log(err)
            await this.client.channels.cache.get(this.config.adminchannelID).send(`Failed to update all roles with the following error ${err}`);
        }
    }

    async addPlayToDb(playData, scoreSaberID, beatSaviorData) {
        const isRanked = (playData.pp > 0)

        let play = {
            leaderboardId: playData.leaderboardId,
            score: playData.score,
            hash: playData.songHash.toUpperCase(),
            maxscore: 0,
            player: scoreSaberID,
            diff: playData.difficultyRaw,
            date: new Date(playData.timeSet).getTime(),
            ranked: isRanked,
            pp: playData.pp,
            gained: false
        }

        if (beatSaviorData) {
            play["beatsavior"] = beatSaviorData;
        }

        await this.db.collection("discordRankBotScores").updateOne({ hash: playData.songHash, player: scoreSaberID, diff: playData.difficultyRaw }, { $set: play }, { upsert: true })
    }

    async getTopScores(scoreSaberId) {
        let reachedEndOfRanked = false;
        let pageOfScoreSaber = 1;

        while (!reachedEndOfRanked) {
            let executions = 0;
            const scores = await limiter.schedule({ id: `Top ${scoreSaberId} page:${pageOfScoreSaber}` }, async () => {
                executions++;
                const response = await fetch(`https://new.scoresaber.com/api/player/${scoreSaberId}/scores/top/${pageOfScoreSaber}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });
                if (executions > 3) console.log(`Failed multiple times to get scores from ${scoreSaberId} page: ${pageOfScoreSaber}.`)
                else {
                    for (let i = 0; i < scores.scores?.length; i++) {
                        if (scores.scores[i].pp === 0) {
                            reachedEndOfRanked = true;
                        } else await this.addPlayToDb(scores.scores[i], scoreSaberId);
                    }
                }
                pageOfScoreSaber++;
            })
        }
        console.log(`Reached end of ranked for ${scoreSaberId} `);
    }

    async getRecentScores(scoreSaberID) {
        let foundSeenPlay = false;
        let pageOfScoreSaber = 1;

        const dbresLatestScore = await this.db.collection("discordRankBotScores").find({ player: scoreSaberID }).sort({ date: -1 }).limit(1).toArray();
        let beatSaviorScores = [];
        let beatSaviorChecked = false;

        while (!foundSeenPlay) {
            let executions = 0;
            const scores = await limiter.schedule({ id: `Recent ${scoreSaberID} page: ${pageOfScoreSaber}` }, async () => {
                executions++;
                const response = await fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${pageOfScoreSaber}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });
                if (executions > 3) {
                    console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`)
                }
                else {
                    for (let i = 0; i < response.scores?.length; i++) {
                        if (new Date(response.scores[i].timeSet).getTime() <= new Date(dbresLatestScore[0].date).getTime()) {
                            foundSeenPlay = true;
                            break;
                        }
                        else {
                            if (!beatSaviorChecked) {
                                beatSaviorScores = await this.client.beatsavior.getRecentPlays(scoreSaberID);
                                if (beatSaviorScores) beatSaviorScores.reverse();
                                beatSaviorChecked = true;
                            }
                            if (beatSaviorScores == null) {
                                await this.addPlayToDb(response.scores[i], scoreSaberID);
                            }
                            else {
                                for (let j = 0; j < beatSaviorScores.length; j++) {
                                    if (beatSaviorScores[j].trackers.scoreTracker.rawScore === response.scores[i].unmodififiedScore && response.scores[i].songHash === beatSaviorScores[j].songID) {
                                        await this.addPlayToDb(response.scores[i], scoreSaberID, beatSaviorScores[j]);
                                        break;
                                    }
                                    if (j === beatSaviorScores.length - 1) {
                                        await this.addPlayToDb(response.scores[i], scoreSaberID);
                                    }
                                }
                            }
                        }
                    }
                }
            })
            pageOfScoreSaber++;
        }
        console.log(`Reached end of unseen plays for ${scoreSaberID} from recent.`);
    }

    async getOnePageRecent(scoreSaberID, leaderboardId, page) {
        console.log(`Getting one score id: ${leaderboardId}, page: ${page}, user: ${scoreSaberID}`);
        let executions = 0;
        const scores = await limiter.schedule({ id: `Recent ${scoreSaberID} page:${page}` }, async () => {
            executions++;
            const res = await fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${page}`)
                .then(res => res.json())
                .catch(err => { throw new Error(err) });

            if (executions > 3) console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${page}.`)
            else {
                for (let i = 0; i < res.scores?.length; i++) {
                    if (leaderboardId === res.scores[i].leaderboardId) {
                        console.log("Found score");
                        await this.db.collection("discordRankBotScores").updateOne({ leaderboardId: res.scores[i].leaderboardId, player: scoreSaberID }, { $set: { pp: res.scores[i].pp } });
                    }
                }
            }
        })
    }

    async getAllScores(scoreSaberID) {
        let pageOfScoreSaber = 1;
        let reachedLastPage = false;
        let totalScores = 0;

        while (!reachedLastPage) {
            let executions = 0;
            const scores = await limiter.schedule({ id: `Recent ${scoreSaberID} page: ${pageOfScoreSaber}` }, async () => {
                executions++;
                const res = await fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${pageOfScoreSaber}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });

                if (executions === 3) console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`)
                else {
                    for (let i = 0; i < res.scores?.length; i++) {
                        totalScores++;
                        await this.addPlayToDb(res.scores[i], scoreSaberID);
                    }
                }
                if (res.scores?.length === 8) pageOfScoreSaber++;
                else reachedLastPage = true
            });
        }
        console.log(`Reached last page of scores for ${scoreSaberID}. Total scores: ${totalScores} on a total of ${pageOfScoreSaber} pages.`);
    }

    async scoreTracker() {
        const users = await this.db.collection("discordRankBotScores").distinct("player");
        let usersUpdated = 0;
        for (let i = 0; i < users.length; i++) {
            const latestScore = await this.db.collection("discordRankBotScores").find({ player: users[i] }).sort({ date: -1 }).limit(1).toArray();
            if (latestScore[0].date < (Date.now() - 86400000)) {
                await this.getRecentScores(users[i])
                usersUpdated++;
            }
        }
        console.log("Updated scores for", usersUpdated, "users")
    }

    //115
    //2x 115 115 115 115
    //4x 115 115 115 115 115 115 115 115 115
    //8x 115 
    async calculateMaxScore(notes) {
        if (notes == 1) return 115;
        else if (notes <= 4) return 115 + (notes - 1) * 115 * 2;
        else if (notes <= 13) return 115 + 4 * 115 * 2 + (notes - 5) * 115 * 4;
        return 115 + 4 * 115 * 2 + 8 * 115 * 4 + (notes - 13) * 115 * 8
    }

}
module.exports = ScoreSaberUtils;