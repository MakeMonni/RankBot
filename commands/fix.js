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
            if (args[0] === "addcountrytoscores") {
                const botMessage = await message.channel.send("...")
                const users = await client.db.collection("discordRankBotScores").distinct("player");
                let scoresUpdated = 0;
                for (let i = 0; i < users.length; i++) {
                    const user = await client.scoresaber.getUser(users[i]);
                    const response = await client.db.collection("discordRankBotScores").updateMany({ player: users[i] }, { $set: { country: user.country } });
                    scoresUpdated += response.modifiedCount;
                }
                await botMessage.edit(`Updated ${scoresUpdated} to include country tag.`);
            }
            if (args[0] === "unrank/rank") {
                const response = await client.db.collection("discordRankBotScores").updateMany({ pp: { $gt: 0 }, ranked: false }, { $set: { ranked: true } });
                const response2 = await client.db.collection("discordRankBotScores").updateMany({ pp: 0 }, { $set: { ranked: false } });
                await message.channel.send(`Updated ${response.modifiedCount} maps to include ranked true`);
                await message.channel.send(`Removed ranked status from ${response2.modifiedCount}.`)
            }
            else {
                console.time("ppcheck")
                let scoresToRecheck = [];
                let userIdName = [];
                const rankedMaps = await client.db.collection("scoresaberRankedMaps").find().toArray();
                for (let i = 0; i < rankedMaps.length; i++) {
                    const scoresWithoutPp = await client.db.collection("discordRankBotScores").find({ pp: 0, leaderboardId: rankedMaps[i].id }).toArray();
                    for (let j = 0; j < scoresWithoutPp.length; j++) {
                        const user = userIdName.find(player => player.id === scoresWithoutPp[j].player);
                        let userName;
                        if (!user) {
                            console.log("new user");
                            const scUser = await client.scoresaber.getUser(scoresWithoutPp[j].player);
                            userIdName.push({ id: scoresWithoutPp[j].player, name: scUser.name });
                            userName = scUser.name;
                        }
                        else {
                            userName = user.name
                        }
                        scoresToRecheck.push({ playerId: scoresWithoutPp[j].player, leaderboardId: scoresWithoutPp[j].leaderboardId, name: userName })
                    }
                }
                for (let i = 0; i < scoresToRecheck.length; i++) {
                    await client.scoresaber.getUserScoreOnLeaderboard(scoresToRecheck[i].playerId, scoresToRecheck[i].name, scoresToRecheck[i].leaderboardId)
                }
                console.timeEnd("ppcheck")
                await message.channel.send(`Recheck ${scoresToRecheck.length} scores for a pp value`);
            }
        }
    }
}
module.exports = Fix;