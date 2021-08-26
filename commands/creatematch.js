const Command = require("../core/command/command.js");

class Test extends Command {
    async run(client, message, args) {
        if (message.member.roles.cache.some(role => role.name === 'Koordinaattori')) {
            const res = await client.db.collection("activeMatches").findOne({ 'match.coordinator.id': message.author.id });
            if (res !== null) {
                message.channel.send("You can only have 1 active match, delete your current one if you want to make a new one.");
                return;
            }

            if (args.length <= 0) {
                message.channel.send("No players provided.");
                return;
            }

            let match = {};
            match.coordinator = { id: message.author.id, username: message.author.username }
            match.players = [];
            for (let i = 0; i < args.length; i++) {
                let user = await client.misc.getUserFromMention(args[i]);
                if (!user) {
                    await message.channel.send(`Player \`#${i+1}\` was not a user, canceling match creation.`)
                    return;
                }
                let player = { id: user.id, username: user.username }
                match.players.push(player);
            }
            client.db.collection("activeMatches").insertOne({ match });
            message.channel.send("Match created.")
        }
        else {
            message.channel.send("You are not a coordinator and cannot create a match...")
        }
    }
}
module.exports = Test;