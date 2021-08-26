const Command = require("../core/command/command.js");

class Test extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            await client.beatsaver.getMapDataGithub();
            message.channel.send("Done")
        }
    }
}
module.exports = Test;