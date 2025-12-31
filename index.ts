import { spawn } from "node:child_process";
import { serve } from "bun";
import console from "node:console";
import path from "node:path";

const pSpawn = () => {
    const p = spawn(
        'lake',
        ['exe', 'leanaide_process'],
        {
            cwd: path.resolve(import.meta.dir, '..')
        }
    )
    p.stderr.on('error', (err: Error) => {
        console.error(`leanaide_process [ERRORS]: ${err}`)
    })
    return p
}

const Proc = {t : pSpawn()}

Proc.t.stderr.on('error', (err : Error) => {
    console.error(`Leanaide Process stderr: ${err}`)
})

//@ts-ignore
const pGet = (resolve, reject) => {
    const onError = (err: Error) => {
        Proc.t.stdout.removeListener('data', onData)
        Proc.t.removeListener('error', onError)
        reject(err)
    }
    const onData = (data: Buffer) => {
        const decoder = new TextDecoder()
        const response = decoder.decode(data)

        Proc.t.stdout.removeListener('data', onData) // Corrected: ensure data listener is removed
        Proc.t.removeListener('error', onError)
        resolve(response)
    }

    return {
        onData,
        onError
    }
}


//@ts-ignore
const pAttachListener = (message : string) => (resolve, reject) => {
    const { onData, onError } = pGet(resolve, reject)

    Proc.t.stdout.on('data', onData)
    Proc.t.on('error', onError)

    Proc.t.stdin.write(`${message}\n`, (err) => err ? reject(err) : null)

}

const LeanaideProcess = {
    t: Proc.t,
    handler: (message : string) => {
        const listener = pAttachListener(message)
        const promise = new Promise<string>(listener)
        return promise
    }
}

const server = serve({
    port: 4040,
    routes: {
        '/' : {
        POST: async (req) => {

            try {

                const body = await req.body?.json()
                const bodyString = JSON.stringify(body)

                console.log(`Sending to Lean process: ${bodyString}`)


                const resp = await LeanaideProcess.handler(bodyString)

                console.log(`Received from Lean process: ${resp}`)

                return (new Response(resp, {
                    headers: { 'Content-Type' : 'application/json' }
                }))

            } catch (error) {
                console.error(`Error processing request:`, error)
                return (new Response('Failed to process request', { status : 500 })) 
            }

        }}
    }
})

console.log(`Listening at ${server.url.host}`)