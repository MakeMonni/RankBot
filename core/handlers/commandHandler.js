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
            if (command === "losses") command = "gains"

            const cmd = this.commands.get(command);
            if (cmd != null)
                try {
                    if (this.client.commandsDisabled && !this.client.checkIfOwner(message, true)) {
                        await message.channel.send("Commands are currently disabled. Wait for owner to enable them again.");
                        return;
                    }
                    await cmd.run(this.client, message, args);
                    if (this.client.config.easterEggs === "aprilFools") await message.channel.send(randomTatti())
                }
                catch (err) {
                    console.log(err);
                    await message.channel.send("We ran into an error running this command, sorry.")
                }
            else {
                await message.channel.send(`No such command exists. \`${this.prefix}help\` if you need it.`)
            }
        });
    }
}
module.exports = CommandHandler;

function randomTatti() {
    const links = [
        "https://suomenluonto.fi/wp-content/uploads/2020/08/talitiaiset-1000x668.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/veritatti_lassekosonen-1000x718.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/kangastatti_jarkkokorhonen-1000x808.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/nokitatti_lassekosonen-1000x708.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/koivunpunikkitatti_lassekosonen-1000x918.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/samettitatti_timoviitanen.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/sappitatti_jarkkokorhonen.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/voitatti_jarkkokorhonen.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/ruskotatti_lassekosonen-1000x755.jpg",
        "https://suomenluonto.fi/wp-content/uploads/2020/08/herkkutatti_jarkkokorhonen-1000x833.jpg",
        "https://puutarha.net/artikkelit/img/20198/59606.jpg",
        "https://puutarha.net/artikkelit/img/20198/59603.jpg",
        "https://puutarha.net/artikkelit/img/20198/59607_p_ver-1.jpg"
    ]
    let r = Math.floor(Math.random() * links.length);
    return links[r];
}