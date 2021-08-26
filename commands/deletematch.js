const Command = require("../core/command/command.js");

class DeleteMatch extends Command {
    async run(client, message, args) {
        if (message.member.roles.cache.some(role => role.name === 'Koordinaattori')) {
            const match = await client.db.collection("activeMatches").findOne({ 'match.coordinator.id': message.author.id });
            if (match === null) {
                message.channel.send("You did not have an active match.");
            }
            else {
                client.db.collection("activeMatches").deleteOne({ _id: match._id });
                message.channel.send("Match deleted.");
            }
        }
        else {
            message.channel.send("You are not a coordinator and cannot delete a match...");
        }
    }
}
module.exports = DeleteMatch;


