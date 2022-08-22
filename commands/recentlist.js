const Command = require("../core/command/command.js");

class RecentList extends Command {
    async run(client, message, args) {
        const botMessage = await message.channel.send("Collecting scores...");
        const playerId = args[0]
        const amount = parseInt(args[1])
        if (!amount || !playerId) {
            await botMessage.edit(`Invalid arguments provided.\n Here is an example: \`${client.config.prefix}recentlist 76561198061930684 20\``);
            return;
        }
        else if (amount < 0) {
            await botMessage.edit("Invalid amount. Your playlist cannot have less than 0 maps :upside_down:");
            return;
        }

        const user = await client.scoresaber.getUser(playerId);

        if (await client.db.collection("discordRankBotScores").find({ player: playerId }).count() === 0) {
            
            if (!user.errorMessage) {
                await client.scoresaber.getAllScores(playerId);
            }
            else {
                await botMessage.edit(`Ran into an error finding this user, make sure they exist at https://scoresaber.com/u/${playerId}`);
                return;
            }
        }
        else {
            await client.scoresaber.getRecentScores(playerId);
        }

        const res = await client.rankbotApi.apiCall(client.config.syncURL + `/recent?a=${amount}&p=${playerId}&n=${user.name}`);
        const playlistAttachment = await client.misc.jsonAttachmentCreator(res, `Recent${amount}${user.name}`);
        let msgString = `${message.author} Here is ${res.songs.length} recently played maps by ${user.name}.`

        await botMessage.delete()
        await message.channel.send(msgString, playlistAttachment)
    }
}
module.exports = RecentList;