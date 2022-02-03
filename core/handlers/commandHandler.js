class CommandHandler {
    constructor(client, prefix, commands) {
        this.prefix = prefix;
        this.client = client;
        this.commands = commands;
    }

    init() {
        this.client.on("message", async message => {
            if (!message.content.startsWith(this.prefix) || message.author.bot) return;
            if (message.channel.type === "dm") {
                await message.channel.send("Sorry this bot does not take commands in DMs.");
                return;
            }

            const args = message.content.slice(this.prefix.length).trim().split(' ');
            let command = args.shift().toLowerCase();
            console.log(command);
            if(command === "losses") command = "gains"

            const cmd = this.commands.get(command);
            if (cmd != null) await cmd.run(this.client, message, args);
            else {
                await message.channel.send(`No such command exists. \`${this.prefix}help\` if you need it.`)
            }
        });
    }
}
module.exports = CommandHandler;