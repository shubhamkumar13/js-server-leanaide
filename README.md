# Leanaide Server

<details>
<summary>
    LINUX
</summary>
<h2>Pre-Requisites</h2>

<ol>
<li> Install Mise 
    <code>curl https://mise.run | sh</code>
</li>
<li> 
Use mise to add the following things 
    <ol>
        <li> Bun 
            <code>mise use bun</code> 
        </li>
        <li> Node 
            <code>mise use node</code> 
        </li>
    </ol>
</li>

<li>
Run <code>bun init</code> 
from the server directory. <br>
Wait for the packages to install.
</li>

<li>
Install a containerized version of RabbitMQ. <br>

<pre>
<code class="language-bash">docker run -d \
  --name rabbitmq \
  -p 5672:5672 \ # port used by queues for message passing
  -p 15672:15672 \ # for accessing UI from localhost:15672
  rabbitmq:management
</code></pre>

This docker container handles the results <br>
and tasks exchanged between the leanaide <br>
server and the client server. <br><br>
The broker <b>CURRENTLY SUPPORTS</b> being <br>
installed on the client server
<b>ONLY</b>.
<br><br>

<blockquote>
> this might change depending <br> 
> on how resources are handled <br> 
> currently restricting to client
</blockquote> 
<br>

Without the broker the servers cannot talk.

</ol>

<h2>Running the servers</h2>
<ol>
<li> 
Run <code>bun run-leanaide-server</code> to run <br> 
the leanaide server.
</li>
<li>

To run the client server (ideally on a diff machine) <code> bun run-producer-server</code>.<br>

<em> 
Using <code>producer-server</code> because diagrams and code <br> 
use that term. Whenever one comes across <br> the term "producer" - it implies client side. Whether it is code or diagram
</em>
</li>
</ol>

<h2>Testing the server</h2>
<p>
    Before we start testing the server, I have this WIP <br> 
    diagram which kind of informs me how data flows. <br>
    <p><img src="spec.png" alt="spec diagram"></img></p>
</p>
<p>
The "Process Wrapper" section is the leanaide process. <br> 
Since it is a purely stdin and stdout process.
<ol>
<li>
<h3>Dummy client on the same machine</h3>
    Currently using the dummy client provided as producer client which one can run on the same machine :
    <code>bun run-dummy-client</code>
</li>
</ol>
</p>
</details>

<details>
    <summary>
        WINDOWS
    </summary>
    WIP
</details>
<details>
    <summary>
        Mac
    </summary>
    Similar to steps for linux but not tested so proceed with caution
</details>
