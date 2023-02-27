const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const limiter = new Bottleneck({
    reservoir: 70,
    reservoirRefreshAmount: 70,
    reservoirRefreshInterval: 60 * 1000,
});

class BeatSaviorUtils {
    constructor(db, config, client) {
        this.db = db;
        this.config = config;
        this.client = client;
    }

    // Deprecating this as BeatSavior is not fully functional and is not getting updated to fix those issues, moving to beatleader to fetch the relevant data
    async getRecentPlays(scoreSaberID, setup) {
        const userWithBeatSavior = await this.db.collection("discordRankBotUsers").findOne({ scId: scoreSaberID, beatsavior: true });
        if (userWithBeatSavior == null && setup == false) {
            return null;
        }

        let executions = 0;
        const scores = await limiter.schedule({ id: `BeatSavior id: ${scoreSaberID}` }, async () => {
            executions++;
            let response
            try {
                response = await fetch(`https://beat-savior.herokuapp.com/api/livescores/player/${scoreSaberID}`)
                    .then(res => res.json())
                    .catch(err => { throw new Error(err) });
            }
            catch (err) {
                console.log(err)
                return null;
            }
            if (response[0] != null) {
                return await response;
            }
            if (executions > 3) {
                return null;
            }
        })
        return await scores;
    }
}

module.exports = BeatSaviorUtils;