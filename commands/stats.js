const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Stats extends Command {
    async run(client, message, args) {
        const scoreStats = await client.db.collection("discordRankBotScores").stats();
        //const withBeatSaviorStats = await client.db.collection("discordRankBotScores").find({ beatsavior: { $exists: true } }).count()
        const scoreBDsize = Math.round(scoreStats.size / 1048576 * 100) / 100;
        const distinctPlayers = await client.db.collection("discordRankBotScores").distinct("player");

        const songStats = await client.db.collection("beatSaverLocal").stats();
        const songDBsize = Math.round(songStats.size / 1048576 * 100) / 100;
        const deletedCount = await client.db.collection("beatSaverLocal").find({ deleted: true }).count()
        const automapperCount = await client.db.collection("beatSaverLocal").find({ automapper: true }).count()

        const rankedDiffCount = await client.db.collection("scoresaberRankedMaps").countDocuments();
        const rankedMapCount = await client.db.collection("scoresaberRankedMaps").distinct("hash");

        const userStats = await client.db.collection("discordRankBotUsers").stats();

        const embed = new Discord.MessageEmbed()
            .setColor('#513dff')
            .addField(`Scores`, `${scoreStats.count} scores taking ${scoreBDsize}MB.\nFrom ${distinctPlayers.length} unique players.`)
            .addField(`Songs`, `${songStats.count} maps taking ${songDBsize}MB.\nDeleted maps: ${deletedCount} \nAutomapped: ${automapperCount}`)
            .addField(`Ranked`, `${rankedMapCount.length} maps with ${rankedDiffCount} diffs.`)
            .addField(`Users`, `${userStats.count} users registered.`)
            .setTimestamp()

        await message.channel.send(embed);
    }
}
module.exports = Stats;