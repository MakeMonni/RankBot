const Command = require("../core/command/command.js");

class BeatSavior extends Command {
    async run(client, message, args) {
        await message.channel.send("This command is deprecated and should be removed...")
        return;
        const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
        if (!user) {
            await message.channel.send(`You are not a registered user. Use \`${client.config.prefix}addme\` first.`);
            return;
        }
        if (user.beatsavior) {
            await message.channel.send("You are already BeatSaviored...");
            return;
        }
        const latestUserScore = await client.db.collection("discordRankBotScores").find({ player: user.scId }).sort({ date: -1 }).limit(1).toArray();
        if (latestUserScore.length == 0) {
            await message.channel.send(`You have no scores seen by me :(.\nUse ${client.config.prefix}gains first.`);
            return;
        }
        await client.scoresaber.getRecentScores(user.scId);
        const saviorScores = await client.beatsavior.getRecentPlays(user.scId, true);
        if (saviorScores != null) {
            saviorScores.reverse();
        }

        for (let i = 0; i < saviorScores?.length; i++) {
            if (saviorScores[i].trackers.scoreTracker.rawScore === latestUserScore[0].score && saviorScores[i].songID === latestUserScore[0].hash) {
                await message.channel.send("Verified you as a beatsavior user, saving savior data from this point onwards.")
                client.db.collection("discordRankBotUsers").updateOne({ discId: message.author.id }, { $set: { beatsavior: true } });
                return;
            }
        }
        await message.channel.send(`Could not verify you as a beatsavior user, make sure your mod is working correctly.` +
            `You can check if you have scores set at <https://www.beatsavior.io/#/profile/${user.scId}> in the **Last Played tab**`
        )
    }
}
module.exports = BeatSavior;