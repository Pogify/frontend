import React from "react";
import * as auth from "../utils/spotifyAuth";
import * as SessionManager from "../utils/sessionManager";
import {debounce} from "../utils/debounce"
import axios from "axios";
import { Player, Donations } from ".";
import { Layout } from "../layouts";
import { storesContext } from "../contexts";


export default class HostPlayer extends React.Component {
  static contextType = storesContext
  lastUpdate = {
    uri: "",
    playing: undefined,
    position:0,
    time: Date.now()
  }
  state = {
    loading: false,
    pso: undefined
  };

  setTokenRefreshInterval = () => {
    // refresh token
    this.refreshInterval = setInterval(
      SessionManager.refreshToken,
      30 * 60 * 1000,
      [window.localStorage.getItem("pogify:token")]
    );
  };

  initializePlayer = async () => {
    this.setState({
      loading: true
    })
    window.spotifyReady = true;
    await this.context.playerStore.initializePlayer("Pogify Host", true)

    this.context.playerStore.player.on("player_state_changed", debounce((data) => {
    // debounce incoming data. 
      let uri, position, playing
      if (data) {
        // TODO: 
        uri = data.track_window.current_track.uri
        position = data.position
        playing = !data.paused
        // check that uri or playing changed
        if (this.lastUpdate.uri != uri || this.lastUpdate.playing != playing) {
          SessionManager.publishUpdate(uri, position, playing);
        } else {
          // if uri and playing didn't change then,
          // TODO: check that difference is beyond threshold to update 
          // ???: how to differentiate stutters from seek. 
          // changes smaller than 1000 are considered stutters and changes greater than 1000 are considered seeks
          console.log(Math.abs(position - (this.lastUpdate.position + (Date.now() - this.lastUpdate.time))), position,this.lastUpdate.position, (Date.now() - this.lastUpdate.time))
          if (Math.abs(position - (this.lastUpdate.position + (Date.now() - this.lastUpdate.time))) > 1000) {
            SessionManager.publishUpdate(uri, position, playing);
          }
        }
      } else {
        uri = ""
        position = this.context.playerStore.position
        playing = false
        SessionManager.publishUpdate(uri, position, playing)
      }
      this.lastUpdate = {
        uri, playing, position, time: Date.now()
      }
      // it seems 300 is about a good sweet spot for debounce.
      // Hesitant to raise it anymore because it would increase latency to listener
    }, 400));
    this.setState({ loading: false });
  };

  changeVolume = (e) => {
    this.player.setVolume(e.target.value);
    this.setState({
      volume: e.target.value,
    });
  };

  componentDidMount() {
    window.onbeforeunload = () => {
      this.publishUpdate("", this.state.position, false);
    };

  }

  componentWillUnmount() {
    this.context.playerStore.player.removeListener("player_state_changed")
    // remove player_state_changed listener on unmount
    this.publishUpdate("", this.state.position, false);
    window.onbeforeunload = null;
    clearInterval(this.refreshInterval);
  }

  render() {
    if (!window.localStorage.getItem("spotify:refresh_token")) {
      return (
        <Layout>
          <button onClick={this.initializePlayer}>Login with Spotify</button>
        </Layout>
      );
    }

    if (!this.context.playerStore.player) {
      return <Layout>
        <button onClick={this.initializePlayer}>Start Session</button>
      </Layout>
    }

    if (this.state.loading && this.state.pso) {
      return (
        <Layout>
          <div>Loading</div>
        </Layout>
      );
    }

    

    // return <div>done</div>
    return (
      <Layout>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Player />
          <div
            style={{
              width: 400,
              textAlign: "center",
              padding: 30,
            }}
          >
            <h2>Hosting to {this.state.connections} listeners.</h2>
            <p style={{ textAlign: "justify" }}>
              You can continue using Spotify as you normally would. The music is
              playing through this browser tab, you can open this tab in a new
              window to exclude it from OBS.
              <b> Please do not close this tab.</b>
            </p>
            <p style={{ marginTop: 40 }}>
              Share the url below to listen with others:
              <br />
              {window.location.href}
            </p>
            <p style={{ marginBottom: 0 }}>Playback powered by</p>
            <a href="https://www.spotify.com">
              <img
                alt="Spotify Logo"
                width="80px"
                height="24px"
                style={{ verticalAlign: "middle", padding: 12 }}
                src="/spotify-logo-green.png"
              />
            </a>
            <Donations />
          </div>
        </div>
      </Layout>
    );
  }
}
