const Command = require("../core/command/command.js");

class Snipelist extends Command {
    async run(client, message, args) {
        {
            const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
            let targetUser;
            let userName

            if (!args[0]) {
                await message.channel.send(`No target user provided, try \`${client.config.prefix}snipelist scoresaberID / @ping\``);
                return;
            }

            if (!user) {
                await message.channel.send("You are not registered.");
                return;
            }
            const mentionedUser = await client.misc.getUserFromMention(args[0]);
            let targetUserScId;

            if (mentionedUser) {
                const targetUser = await client.db.collection("discordRankBotUsers").findOne({ discId: mentionedUser.id });
                if (!targetUser) {
                    await message.channel.send("That user is not registered...");
                    return;
                }
                else {
                    userName = targetUser.discName;
                    targetUserScId = targetUser.scId;
                }
            }
            else if (isFinite(args[0])) {
                targetUser = await client.scoresaber.getUser(args[0]);
                if (targetUser?.playerInfo?.playerId) {
                    targetUserScId = targetUser.playerInfo.playerId;
                    userName = targetUser.playerInfo.playerName
                }
                else {
                    await message.channel.send(`Not a valid scoresaber user.\nMake sure the user exists at <https://scoresaber.com/u/${args[0]}>`);
                    return;
                }
            }
            else {
                await message.channel.send(`Not a valid target for a snipelist.\n Try \`${client.config.prefix}snipelist scoresaberID / @ping\``);
                return;
            }
            const botmsg = await message.channel.send("Gathering and comparing scores, this might take a moment.");

            const scoresFromUser = await client.db.collection("discordRankBotScores").find({ player: user.scId }).count();
            if (!scoresFromUser) {
                await client.scoresaber.getAllScores(user.scId);
            }
            else {
                await client.scoresaber.getRecentScores(user.scId);
            }

            const scoresFromTargetUser = await client.db.collection("discordRankBotScores").find({ player: targetUserScId }).count();
            console.log(scoresFromTargetUser)
            if (!scoresFromTargetUser) {
                await client.scoresaber.getAllScores(targetUserScId);
            }
            else {
                await client.scoresaber.getRecentScores(targetUserScId);
            }

            let targetScores;
            let snipeScoreHashes = [];
            let unplayedScoreHashes = [];

            if (args[1] === "ranked") {
                targetScores = await client.db.collection("discordRankBotScores").find({ player: targetUserScId, ranked: true }).toArray();
            }
            else if (args[1] === "unranked") {
                targetScores = await client.db.collection("discordRankBotScores").find({ player: targetUserScId, ranked: false }).toArray();
            }
            else {
                targetScores = await client.db.collection("discordRankBotScores").find({ player: targetUserScId }).toArray();
            }

            for (let i = 0; targetScores.length > i; i++) {
                const userScore = await client.db.collection("discordRankBotScores").findOne({ player: user.scId, leaderboardId: targetScores[i].leaderboardId });
                const songHash = {
                    hash: targetScores[i].hash,
                    difficulties: [
                        {
                            characteristic: client.beatsaver.findPlayCategory(targetScores[i].diff),
                            name: client.beatsaver.convertDiffNameBeatSaver(targetScores[i].diff)
                        }
                    ]
                }
                if (!userScore) {
                    unplayedScoreHashes.push(songHash);
                }
                else if (userScore.score < targetScores[i].score) {
                    snipeScoreHashes.push(songHash);
                }
            }
            if (snipeScoreHashes.length == 0) {
                botmsg.delete();
                await message.channel.send(`${message.author} there was no scores to be sniped.`);
                return;
            }

            const playlistAttachment = await client.misc.createPlaylist(`Sniping_${userName}`, snipeScoreHashes, "https://cdn.discordapp.com/attachments/840144337231806484/893593688373084210/unknown.png");
            botmsg.delete();
            await message.channel.send(`${message.author}, here is your playlist. Get sniping.\nIt has ${snipeScoreHashes.length} maps.`, playlistAttachment);
        }
    }
}
module.exports = Snipelist;

