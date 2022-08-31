const Command = require("../core/command/command.js");

class CountryRank extends Command {
    async run(client, message, args) {
        const playerId = args[0];
        const rank = args[1];

        const user = await client.scoresaber.getUser(playerId)
        if (user.errorMessage) {
            await message.channel.send(`This user does not seem to exist, make sure they exist at https://scoresaber.com/u/${playerId}`);
            return;
        }
        if (user.country != client.config.country) {
            await message.channel.send(`Sorry this command is currently only available to users from ${client.config.country}`);
            return;
        }

        if (await client.db.collection("discordRankBotScores").find({ player: playerId }).count() === 0) {
            await client.scoresaber.getAllScores(playerId);
        }
        else {
            await client.scoresaber.getRecentScores(playerId);
        }
        user.name = user.name.replaceAll(' ', '-');
        const res = await client.rankbotApi.apiCall(client.config.syncURL + `/countryRank?p=${playerId}&c=${user.country}&r=${rank}&n=${user.name}`);
        const playlistAttach = await client.misc.jsonAttachmentCreator(res, `${user.name}s rank ${rank}s`);

        await message.channel.send("Here you go :)", playlistAttach);
    }
}
module.exports = CountryRank;