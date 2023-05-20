const Command = require("../core/command/command.js");
// test
class Test extends Command {
    async run(client, message, args) {
        await message.channel.send("Nice test yes.");
    }
}
module.exports = Test;