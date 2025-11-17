import { decodeBase64 } from "jsr:@std/encoding/base64"

const keyPair = {
    private: await crypto.subtle.importKey(
        "pkcs8",
        decodeBase64(Deno.env.get("PRIVATE_KEY")!),
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["decrypt"],
    ),
    public: await crypto.subtle.importKey(
        "spki",
        decodeBase64(Deno.env.get("PUBLIC_KEY")!),
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["encrypt"],
    ),
}

const textDecoder = new TextDecoder()

const socket = new WebSocket(
    "wss://" +
        Deno.env.get("SERVER_HOST") +
        ":7531/connect?module=joinAlerts&events=team_join&secret=" +
        encodeURIComponent(Deno.env.get("CONNECTION_SECRET")!),
)

socket.addEventListener("open", () => {
    console.log("Socket open")
})

let xoxb = ""

socket.addEventListener("message", async (ev) => {
    let data = ""
    if (typeof ev.data == "string") {
        data = ev.data
    } else {
        const encryptedData = await ev.data.arrayBuffer()
        data = textDecoder.decode(
            await crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                keyPair.private,
                encryptedData,
            ),
        )
    }
    if (data.startsWith("xoxb-")) {
        xoxb = data
    }
    if (data.startsWith("event {")) {
        const eventData = JSON.parse(
            data.split("event ").slice(1).join("event "),
        )
        if (eventData.type == "team_join") {
            console.log(eventData)
            await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + xoxb,
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: JSON.stringify({
                    channel: "C09T915K406",
                    text: `<@${eventData.user.id}> joined the Slack!`,
                }),
            })
        }
    }
})
