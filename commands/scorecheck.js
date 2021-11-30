const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class ScoreCheck extends Command {
    async run(client, message, args) {
        if (!args[0]) {
            await message.channel.send("No leaderboard id provided");
            return;
        }
        if (isNaN(args[0])) {
            await message.channel.send("Not a valid leaderboard id, use only numbers");
            return;
        }

        let userId;
        if (!args[1]) {
            const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
            userId = user.scId
        }
        else {
            userId = args[1]
        }

        const score = await client.db.collection("discordRankBotScores").findOne({ player: userId, leaderboardId: parseInt(args[0]) });
        if (!score) {
            await message.channel.send("No score found by that user on that map");
            return;
        }

        const map = await client.beatsaver.findMapByHash(score.hash);
        if (!map) {
            await message.channel.send("Couldnt find the map");
            return;
        }
        const date = new Date(score.date)
        const dateString = `${date.getDate()}.${date.getMonth()}.${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}`;

        const embed = new Discord.MessageEmbed()
            .setTitle(`${map.metadata.songName}`)
            .setURL(`https://scoresaber.com/leaderboard/${args[0]}`)
            .setThumbnail(`${map.versions[0].coverURL}`)
            .addField(`Score`, `${score.score} - **${round(score.score / score.maxscore * 100)}%** | pp: **${score.pp}** \n${dateString}`)

        if (score.beatsavior) {
            const accTracker = score.beatsavior.trackers.accuracyTracker;
            const hitTracker = score.beatsavior.trackers.hitTracker;
            const winTracker = score.beatsavior.trackers.winTracker;

            embed.addField(`Beatsavior`, `Swing: ${round(accTracker.accLeft)} | ${round(accTracker.accRight)} \nFC acc: ${round((accTracker.accLeft + accTracker.accRight) / 2 / 115 * 100)}%\nTD: ${round(accTracker.leftTimeDependence)} | ${round(accTracker.rightTimeDependence)}`);
            embed.addField(`Hit & combo`, `Notes: ${hitTracker.leftNoteHit} | ${hitTracker.rightNoteHit}\n:boom: ${hitTracker.bombHit} | :x: ${hitTracker.miss} | Walls hit: ${hitTracker.nbOfWallHit} | :pause_button: ${winTracker.nbOfPause} \nHighestCombo: ${hitTracker.maxCombo}`)
        }

        await message.channel.send(embed);
    }
}
module.exports = ScoreCheck;

function round(number) {
    return Math.round(number * 100) / 100;
}