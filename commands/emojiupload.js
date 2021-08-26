const Command = require("../core/command/command.js");

class EmojiUpload extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            message.guild.emojis.create(`Images/updooter2.png`, `small_green_triangle_up`).then(emoji => message.channel.send(`The following emoji was uploaded ${emoji}`));
        };
    }
}
module.exports = EmojiUpload;