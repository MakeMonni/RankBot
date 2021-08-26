const Command = require("../core/command/command.js");

class ToggleUpdates extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            if (client.updates) {
                client.updates = false;
                await message.channel.send("Updates off.");
            }
            else if (!client.updates) {
                client.updates = true;
                await message.channel.send("Updates on.")
            }
        }
    }
}
module.exports = ToggleUpdates;