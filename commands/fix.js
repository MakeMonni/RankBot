const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Fix extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            let removedScores = 0;
            let result = await client.db.collection("discordRankBotScores").aggregate(
                {
                    $group: {
                        _id: { player: "$player", leaderboardId: "$leaderboardId" },
                        count: { $sum: 1 },
                        docs: { $push: "$score" }
                    }
                },
                {
                    $match: {
                        count: { $gt: 1 }
                    }
                }
            ).toArray();
            console.log(result.length);
            for (let i = 0; i < result.length; i++) {
                if (result[i].count >= 2) {
                    result[i].docs.sort((a, b) => b - a);
                    await client.db.collection("discordRankBotScores").deleteMany({ player: result[i]._id.player, leaderboardId: result[i]._id.leaderboardId, score: {$lt: result[i].docs[0]}});
                    removedScores++
                }
            }
            await message.channel.send(`Removed ${removedScores} old scores.`)
        }
    }
}
module.exports = Fix;