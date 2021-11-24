const fetch = require('node-fetch');

class TwitchUtils {
    constructor(client, config) {
        this.client = client;
        this.config = config
    }

    //Top gamba winner ???
    //Top gamba looser ???

    async streamAdvertisementChannelPost(streamInfo) {
        const streamInfoObject = { streamName: streamInfo.user_name };

        if (streamInfo?.type === 'live') {
            const index = this.client.streamsLive.findIndex(streamInfo => streamInfo.streamName === streamInfoObject.streamName)

            if (index === -1) {
                console.log(streamInfoObject.streamName, " went online")
                this.client.streamsLive.push(streamInfoObject);

                await this.client.channels.cache.get(this.config.streamAdvertisementChannelID).send(`https://www.twitch.tv/${streamInfoObject.streamName}`);
            }
        }
        else if (streamInfo.type === 'offline') {
            const index = this.client.streamsLive.findIndex(streamInfo => streamInfo.streamName === streamInfoObject.streamName)
            if (index !== -1) {
                console.log(streamInfoObject.streamName, " went offline")
                this.client.streamsLive.splice(index, 1);
            }
        }
    }

    async getStreamWithName(loginName) {
        await this.checkAccessToken();
        const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${loginName}`, { headers: { 'Authorization': `Bearer ${this.client.twitchAccessToken}`, 'Client-Id': this.config.twitchClientId } })
            .then(res => res.json())
            .catch(err => { throw new Error(err) });

        if (response.data[0]) return response.data[0];
        else return { user_name: loginName, type: 'offline' }
    }

    async getAccessToken() {
        const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${this.config.twitchClientId}&client_secret=${this.config.twitchClientSecret}&grant_type=client_credentials`, { method: 'POST' })
            .then(res => res.json())
            .catch(err => { throw new Error(err) });
        this.client.twitchAccessToken = response.access_token;
    }

    async checkAccessToken() {
        if (!this.client.twitchAccessToken) {
            await this.getAccessToken();
        }
        else {
            const response = await fetch(`https://id.twitch.tv/oauth2/validate`, { headers: { 'Authorization': `Bearer ${this.client.twitchAccessToken}` } })
                .then(res => res.json())
                .catch(err => { throw new Error(err) });
            //1 week in seconds
            if (response.expires_in < 604800) {
                await this.getAccessToken();
            }
        }
    }
}
module.exports = TwitchUtils;