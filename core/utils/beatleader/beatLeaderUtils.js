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


}

module.exports = BeatLeaderUtils;