const Command = require("../core/command/command.js");

class Roleme extends Command {
    async run(client, message, args) {
        let query = { discId: message.author.id }
        client.db.collection("discordRankBotUsers").find(query).toArray(async function (err, dbres) {
            if (!dbres[0]?.scId) {
                message.channel.send(`I'm sorry you are not registered, use ${client.config.prefix}addme first.`);
            } else {
                if (err) throw err;
                let user = await client.scoresaber.getUser(dbres[0].scId);

                if (!user.id) {
                    await message.channel.send("Something went terribly wrong, you can try again in a moment.");
                    return;
                }

                if (user.country !== client.config.country) {
                    await message.channel.send("Sorry you are not in the correct country.");
                    return;
                }

                console.log(`Player: ${user.name} countryrank: ${user.countryRank}`);
                try {
                    await client.scoresaber.updateRole(dbres[0].scId, message.author.username, message.author.id);
                    await message.channel.send(`I added an approriate role for your rank.`)
                } catch {
                    await message.channel.send("It seems I was unable to add a role approriate for your rank.")
                    console.log(err);
                };
            }
        })

    }
}
module.exports = Roleme;