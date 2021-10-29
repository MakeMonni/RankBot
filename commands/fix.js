const Command = require("../core/command/command.js");

class Fix extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            let scores = await client.db.collection("discordRankBotScores").find().toArray();
            let lowerCaseHashes = 0;
            console.log("Scores to check: " + scores.length);
            for (let i = 0; i < scores.length; i++) {
                if (scores[i].hash.match(/^[a-z0-9]+$/)) {
                    scores[i].hash = scores[i].hash.toUpperCase();
                    lowerCaseHashes++;
                    await client.db.collection("discordRankBotScores").updateOne({ _id: scores[i]._id }, { $set: scores[i] })
                }
            }
            await message.channel.send(`Fixed ${lowerCaseHashes} lowercase hashes.`)
        }
    }
}
module.exports = Fix;