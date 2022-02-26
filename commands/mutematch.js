const Command = require("../core/command/command.js");

class MuteMatch extends Command {
    async run(client, message, args) {
        if (message.member.roles.cache.some(role => role.name === 'Koordinaattori')) {
            const Gid = client.config.guildId;
            const guild = await client.guilds.fetch(Gid);
            const res = await client.db.collection("activeMatches").findOne({ 'match.coordinator.id': message.author.id });
            if (!res) {
                await message.channel.send("You have no active match...");
                return;
            }
            const match = res.match;
            for (let i = 0; i < match.players.length; i++) {
                const member = await guild.members.fetch({ user: match.players[i].id, force: true });
                const membvoice = member.voice;

                membvoice.serverDeaf ? await membvoice.setDeaf(false, "Match").catch(err => console.error(err)) : await membvoice.setDeaf(true, "Match").catch(err => console.error(err));
                membvoice.serverMute ? await membvoice.setMute(false, "Match").catch(err => console.error(err)) : await membvoice.setMute(true, "Match").catch(err => console.error(err));
            }
            const member = await guild.members.fetch({ user: match.players[0].id });
            member.voice.serverMute ? message.channel.send("Match muted.") : message.channel.send("Match unmuted.")
        }
        else {
            message.channel.send("You are not a coordinator so you cannot mute a match...")
        }
    }
}
module.exports = MuteMatch;