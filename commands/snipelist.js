const Command = require("../core/command/command.js");

class Snipelist extends Command {
    async run(client, message, args) {
        {
            const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
            let targetUser;
            let userName;

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
                if (targetUser?.name) {
                    targetUserScId = targetUser.id;
                    userName = targetUser.name;
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

            if (user.scId === targetUserScId) {
                await message.channel.send("Targeting yourself is not allowed.");
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
            if (!scoresFromTargetUser) {
                await client.scoresaber.getAllScores(targetUserScId);
            }
            else {
                await client.scoresaber.getRecentScores(targetUserScId);
            }

            let category = null;
            userName = userName.replace(" ", "_")

            if (args[1] === "ranked") {
                category = "ranked";
            }
            else if (args[1] === "unranked") {
                category = "unranked";
            }

            let syncURL = `${client.config.syncURL}/snipe?p=${user.scId}&t=${targetUserScId}&c=${category}&n=${userName}`
            if (args[2] === `unplayed`) {
                syncURL+=`&u=true`
            }

            const res = await client.rankbotApi.apiCall(syncURL);
            const attachment = await client.misc.jsonAttachmentCreator(res, `Sniping_${userName}`);

            botmsg.delete();
            let msgString;
            if (res.songs.length > 0) {
                msgString = `${message.author}, here is your playlist. Get sniping.\nIt has ${res.songs.length} maps.`;
            }
            else {
                msgString = `${message.author}, here is your playlist. There are no scores to be sniped ... yet.`;
            }
            await message.channel.send(msgString, attachment);
        }
    }
}
module.exports = Snipelist;