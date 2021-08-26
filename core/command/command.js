class Command {
    async run(client, message, args) {
        await message.channel.send("This no workie yet :)");
    }
}
module.exports = Command;