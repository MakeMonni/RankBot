const Command = require("../core/command/command.js");

class Deleteme extends Command {
    async run(client, message, args) {
        const guild = await client.guilds.fetch(client.config.guildId);
        const member = await guild.members.fetch({ user: message.author.id, force: true });
        const memberRoles = member.roles.cache.array().filter(role => !role.name.startsWith("Top"));
        await member.roles.set(memberRoles);
        client.db.collection("discordRankBotUsers").find({ discId: message.author.id }).toArray(function (err, dbres) {
            if (err) throw err;
            if (!dbres[0]?.discId) {
                message.channel.send(`I dont think you are in the database...`);
            } else {
                client.db.collection("discordRankBotUsers").deleteOne({ discId: message.author.id }, function (err) {
                    if (err) throw err;
                    console.log(`${message.author.username} deleted from the database`);
                })
                message.channel.send("I removed your rankrole & deleted you from the database.");
            }
        })
    }
}
module.exports = Deleteme;