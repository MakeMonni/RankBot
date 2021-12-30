const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Fix extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            if (args[0] === "removedupe") {
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
                for (let i = 0; i < result.length; i++) {
                    if (result[i].count >= 2) {
                        result[i].docs.sort((a, b) => b - a);
                        await client.db.collection("discordRankBotScores").deleteMany({ player: result[i]._id.player, leaderboardId: result[i]._id.leaderboardId, score: { $lt: result[i].docs[0] } });
                        removedScores++
                    }
                }
                await message.channel.send(`Removed ${removedScores} old scores.`);
                return;
            }
            else {
                const botMessage = await message.channel.send("...")
                const users = await client.db.collection("discordRankBotScores").distinct("player");
                let scoresUpdated = 0;
                for (let i = 0; i < users.length; i++) {
                    const user = await client.scoresaber.getUser(users[i]);
                    const response =  await client.db.collection("discordRankBotScores").updateMany({ player: users[i] }, { $set: { country: user.country } });
                    scoresUpdated += response.modifiedCount;
                }
                await botMessage.edit(`Updated ${scoresUpdated} to include country tag.`);
            }
        }
    }
}
module.exports = Fix;