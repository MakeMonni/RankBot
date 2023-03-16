const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const limiter = new Bottleneck({
    reservoir: 350,
    reservoirRefreshAmount: 350,
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

class BeatLeaderUtils {
    constructor(db, config, client) {
        this.db = db;
        this.config = config;
        this.client = client;
    }

    async getUser(beatLeaderID) {
        try {
            let executions = 0;
            const user = await limiter.schedule({ id: `Beatleader User ${beatLeaderID}` }, async () => {
                executions++

                const res = await fetch(`https://api.beatleader.xyz/player/${beatLeaderID}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });

                if (res != null)
                    return res;

                if (executions > 3)
                    return null;
            })
            return user;
        }
        catch (err) {
            console.log(`Had an error: ${err} with scID:${scoreSaberID}`);
            return null
        }
    }

    // This is very slow way to get the desired swing data
    async swingDataLoader(beatLeaderID, lastScoreToFindTime) {
        const timeToFind = lastScoreToFindTime / 1000;
        let page = 1;
        let count = 50;
        let scoreIds = [];
        let swingData = [];
        let allScoresNotFound = true;
        while (allScoresNotFound) {
            await limiter.schedule({ id: `Ranked maps page: ${page}` }, async () => {
                console.log("page", page)
                const res = await fetch(`https://api.beatleader.xyz/player/${beatLeaderID}/scores?sortBy=date&order=desc&page=${page}&count=${count}&time_from=${timeToFind}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });

                scoreIds.push(...res.data.map(x => x.id))
                if (page * count >= res.metadata.total) {
                    allScoresNotFound = false;
                }
                else page++
            })
        }
        //Move this to it's own function
        for (let i = 0; i < scoreIds.length; i++) {
            await limiter.schedule({ id: `` }, async () => {
                console.log("score", i)
                const res = await fetch(`https://api.beatleader.xyz/score/statistic/${scoreIds[i]}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });
                swingData.push(res);
            })
        }
        //This returns an array of swingdata/trackers, while previously we had object.trackers
        console.log(swingData);
    }


}

module.exports = BeatLeaderUtils;