# RTranslator-Web

A self-hosted web version of [RTranslator](https://github.com/niedev/RTranslator) for text translation using [Mozilla models](https://github.com/mozilla/translations). This website is 100% open source.

<img width="1717" height="789" alt="image" src="https://github.com/user-attachments/assets/2c48bd27-9ec3-408e-aac6-9f193711c84b" />

The main feature of this web app is that the translation models—and the entire logic in general—run locally within the browser (frontend).

The server (backend) performs only two tasks: serving the site and providing the translation models for each language (which are stored in the browser's local storage once downloaded).

This allows the site to be hosted at minimal cost (meaning these costs will not be passed on to users) and, above all, ensures total user privacy; just like with RTranslator, everything (except for the model downloads) runs directly on the device where the app is being used.

Plus, thanks to this, after the site is loaded and the required models are downloaded, the site can work offline.
<br/><br/>

## Installation

This web app does not work without HTTPS because it uses OPFS, which requires it. 

The only exception is localhost: OPFS works there without HTTPS, but only when accessing the server from the same machine where it is installed (accessing it from elsewhere on the local network does not work).

The issue is that using HTTPS requires a certificate issued by a CA.

Therefore, for self-hosting, we have only the following options:

1) Do not use HTTPS and access the site only from the machine where it is installed (localhost:3847).
2) Use HTTPS locally with Caddy, but install the Caddy CA in the browsers (or OS) of all external local devices intended to connect to the site.
3) Use Caddy as a custom reverse proxy to access the site via HTTPS both locally and from the internet without needing to install the CA in browsers (this requires the user to have a domain and configure DDNS (or have a static public IP) as well as the router and firewall).

```
                    RTranslator
                         │
          ┌──────────────┴──────────────┐
          │                             │
      BEGINNER                       ADVANCED
          │                             │
   LAN / local use               Real domain name
          │                             │
    ┌─────┴─────┐                 Caddy + public CA
    │           │                       │
same PC     other devices               │
    │           │                       │
localhost   Caddy local CA              │
    │           │                       │
 no cert    trust CA once            automatic
 setup      per client              browser trust
```

<br/><br/>

### 1. Localhost-only installation:

```
     localhost:3847
          │               
          │ HTTP                              
          ▼                                          
┌───────────────────┐                                
│ RTranslator       │
│ React + Node.js   │
└───────────────────┘
```

This is the simplest installation method. With this installation method, you will be able to use the website only from the same PC you installed the server on.
To install the website with this method, follow these instructions:

Install and start Docker Engine on your PC.

Run the following command in your terminal:

`docker run -d --name rtranslator --restart unless-stopped -p 127.0.0.1:3847:3847 -e NODE_ENV=production -e PORT=3847 ghcr.io/niedev/rtranslator-web:latest`

This will download, install, and run the Docker image of the RTranslator-Web server.

Open http://localhost:3847 in your browser to use the website (this will work only from the same PC).


After this initial setup, simply use the following command to stop the server:

`docker stop rtranslator`

And to restart it:

`docker start rtranslator`
<br/><br/>


### 2. LAN-only installation:

```
Your local network                            localhost:3847
        │                                            |
        │ HTTPS                                      |
        │                                            |
        ▼                                            |
┌───────────────────┐                                |
│ Caddy             │                                |
│ ports 80 / 443    │                                | 
│ local HTTPS       │                                | HTTP :3847
└─────────┬─────────┘                                |
          │                                          |
          │ Docker internal network                  |
          │ HTTP :3847                               |
          ▼                                          |
┌───────────────────┐                                |
│ RTranslator       │<-------------------------------/
│ React + Node.js   │
└───────────────────┘
```

This installation method is for pretty experienced users. With this installation method, you will be able to use the website from the same PC you installed the server on or on other devices in the same LAN.
To install the website with this method, follow these instructions:

Install and start Docker Engine on your PC.

Download `RTranslator-web-lan.zip` from the releases.

Extract the folder and navigate into it using the command prompt.

Find the PC's IP address.

Edit the `.env` file, entering the PC's IP address in the LAN_HOST variable.

From within the extracted folder, run this command:

`docker compose up -d`

Docker will now perform these operations:

```
1. Download the RTranslator image
             ↓
2. Download Caddy
             ↓
3. Start RTranslator on internal port 3847
             ↓
4. Start Caddy
             ↓
5. Generate the local HTTPS CA
             ↓
6. Generate a certificate for your LAN IP
```

And the server will be up and running.

At this stage, it will not yet be possible to access the site via hosts other than `localhost` (or `localhost` with HTTPS (using ports 80 and 443), which requires the CA root certificate on the clients).
However, just like in version 1, it will be possible to access the site (only from the PC itself) via HTTP at `localhost:3847` (port 3847, which connects directly to the RTranslator-Web server without going through Caddy).

Now, you must generate the CA root certificate using this command:

`docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./rtranslator-local-ca.crt`

**Note:** Caddy generates a root certificate (for its CA) that is valid only for the public key of the local Caddy server instance (it does not validate other public keys). Therefore, it cannot be shared between different installations.

```
RTranslator-Web/
├── rtranslator-local-ca.crt
├── .env
├── compose.yaml
├── Caddyfile
└── ...
```

Now, you must install the certificate on the operating system or browser of the client devices that need to access the site locally.

Using the browser on the devices with the certificate installed, you can now open the address `https://<IP_ADDRESS>` and use the site.

After this initial setup, simply use the following command (from the extracted folder) to stop the server:

`docker compose down`

And to restart it:

`docker compose up -d`
<br/><br/>


### 3. Internet installation:

This installation is for expert users. You will need to use Caddy as a custom reverse proxy to access the site via HTTPS both locally and from the internet without needing to install the CA in browsers.

To do this, you will need to have a domain, configure DDNS (or have a static public IP), as well as your router and firewall.

Given that this method is for expert users, if you are one, you won't need a tutorial to do this (I'm tired of writing, sorry).
