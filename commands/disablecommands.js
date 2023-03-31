const Command = require("../core/command/command.js");

class DisableCommands extends Command {
    async run(client, message, args) {

        if (client.checkIfOwner(message)) {

            if (!client.commandsDisabled) {
                client.commandsDisabled = true;
                message.channel.send("Commands are now disabled.");
            }
            else {
                client.commandsDisabled = false;
                message.channel.send("Commands are now enabled again.");
            }
        }
    }
}

module.exports = DisableCommands;