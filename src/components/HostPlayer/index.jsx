import React from "react";
import { observer } from "mobx-react";
import { reaction } from "mobx";

import * as SessionManager from "../../utils/sessionManager";
import { playerStore, playlistStore } from "../../stores";

import debounce from "lodash/debounce";

import { Layout } from "../../layouts";

import Player from "../Player";
import PoweredBySpotify from "../utils/PoweredBySpotify";
import Donations from "../utils/Donations";
import CopyLink from "../utils/CopyLink";

import styles from "./index.module.css";

/**
 * HostPlayer handles logic for Pogify Host
 */
class HostPlayer extends React.Component {
  // static contextType = storesContext;
  // lastUpdate property keeps track the data sent in the last publish update
  lastUpdate = {
    uri: "",
    playing: undefined,
    position: 0,
    time: Date.now(),
  };
  state = {
    loading: false,
    pso: undefined,
  };

  /**
   * Sets interval for token refresh
   */
  setTokenRefreshInterval = () => {
    // refresh token
    this.refreshInterval = setInterval(
      SessionManager.refreshToken,
      30 * 60 * 1000,
      [window.localStorage.getItem("pogify:token")]
    );
  };

  /**
   * Initializes spotify player in the player store as host
   */
  initializePlayer = async () => {
    this.setState({
      loading: true,
    });

    this.updateReactionDisposer = reaction(
      () => ({
        videoId: playerStore.videoId,
        playing: playerStore.playing,
        seeking: playerStore.seeking,
      }),
      debounce(({ videoId, playing }) => {
        SessionManager.publishUpdate(
          videoId,
          playerStore.position.value,
          playing
        );
      }, 400),
      {
        equals: () => {
          return (
            playerStore.ended ||
            playerStore.unstarted ||
            playerStore.buffering ||
            playerStore.seeking
          );
        },
      }
    );

    window.onbeforeunload = () => {
      // publish empty string uri on disconnect. Empty string uri means host disconnected
      SessionManager.publishUpdate(
        "",
        playerStore.position.value,
        false,
        playerStore.track_window
      );
    };
    this.setState({ loading: false });
  };

  componentDidMount() {
    this.initializePlayer();
    // set the token refresh interval
    this.setTokenRefreshInterval();
  }

  async componentWillUnmount() {
    if (playerStore.player) {
      // publish unload update when unmounting player
      await SessionManager.publishUpdate("", playerStore.position, false);
    }
    // remove onbeforeunload handler
    window.onbeforeunload = null;
    if (typeof this.updateReactionDisposer === "function") {
      this.updateReactionDisposer();
    }
    // clear refresh interval
    clearInterval(this.refreshInterval);
  }

  render() {
    // loading
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
        <div className="flexContainer">
          <Player isHost />
          <div className={`${styles.textWrapper} textAlignCenter`}>
            <h2>Hosting {SessionManager.SessionCount.get()} listeners.</h2>
            <PlaylistList />
            <div className={styles.shareExplanations}>
              Share the URL below to listen with others:
              <br />
              <CopyLink
                href={window.location.href}
                className={styles.shareLink}
                title="Click to copy and share to your audience"
              >
                {window.location.href}
              </CopyLink>
            </div>
            <Donations large />
          </div>
        </div>
      </Layout>
    );
  }
}

export default observer(HostPlayer);

class _PlaylistList extends React.Component {
  state = {
    videoId: "",
  };
  render() {
    if (!playlistStore.signedIn && playlistStore.gapiInit) {
      return (
        <div>
          not logged in
          <button onClick={playlistStore.signIn}>Sign In</button>
        </div>
      );
    }

    return (
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            playerStore.newTrack(this.state.videoId, undefined, true);
          }}
        >
          <input
            type="text"
            placeholder="video id"
            onChange={(e) => {
              this.setState({ videoId: e.target.value });
            }}
          />
          <button type="submit">Load Video</button>
        </form>
        {/* <ul>
          {playlistStore.playlists.map((item) => {
            return (
              <li key={item.item}>
                <img src={item.snippet.thumbnails.default.url} alt="" />
                {item.snippet.title}
              </li>
            );
          })}
        </ul> */}
        {/* {JSON.stringify(playlistStore.playlists)} */}
      </div>
    );
  }
}
const PlaylistList = observer(_PlaylistList);
