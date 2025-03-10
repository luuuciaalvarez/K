export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "El mensaje no puede estar vacío." });
    }

    try {
        console.log("🔹 Creando un nuevo hilo en OpenAI...");
        const threadResponse = await fetch("https://api.openai.com/v1/threads", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            }
        });

        const threadData = await threadResponse.json();
        if (!threadResponse.ok) {
            console.error("❌ Error al crear el hilo:", threadData);
            return res.status(threadResponse.status).json({ error: threadData });
        }

        const threadId = threadData.id;
        console.log(`✅ Hilo creado con ID: ${threadId}`);

        console.log("🔹 Añadiendo el mensaje del usuario...");
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({ role: "user", content: message })
        });

        const messageData = await messageResponse.json();
        if (!messageResponse.ok) {
            console.error("❌ Error al añadir mensaje:", messageData);
            return res.status(messageResponse.status).json({ error: messageData });
        }

        console.log("✅ Mensaje añadido correctamente");

        console.log("🔹 Ejecutando el asistente...");
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: process.env.OPENAI_ASSISTANT_ID
            })
        });

        const runData = await runResponse.json();
        if (!runResponse.ok) {
            console.error("❌ Error al ejecutar el asistente:", runData);
            return res.status(runResponse.status).json({ error: runData });
        }

        const runId = runData.id;
        console.log(`✅ Asistente ejecutado con ID: ${runId}`);

        console.log("🔹 Esperando la respuesta del asistente...");
        let status = "in_progress";

        while (status === "in_progress" || status === "queued") {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const checkRunResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "OpenAI-Beta": "assistants=v2"
                }
            });

            const checkRunData = await checkRunResponse.json();
            if (!checkRunResponse.ok) {
                console.error("❌ Error al verificar el estado:", checkRunData);
                return res.status(checkRunResponse.status).json({ error: checkRunData });
            }

            status = checkRunData.status;
        }

        console.log("✅ Asistente ha completado la ejecución");

        console.log("🔹 Obteniendo la respuesta...");
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "assistants=v2"
            }
        });

        const messagesData = await messagesResponse.json();
        if (!messagesResponse.ok) {
            console.error("❌ Error al obtener la respuesta:", messagesData);
            return res.status(messagesResponse.status).json({ error: messagesData });
        }

        // 🔹 Capturar correctamente la respuesta del asistente
        const assistantMessage = messagesData.data.find((msg) => msg.role === "assistant");

        if (!assistantMessage || !assistantMessage.content) {
            console.error("❌ OpenAI no devolvió ninguna respuesta.");
            return res.status(500).json({ response: "El asistente no proporcionó una respuesta válida." });
        }

        // 🔹 Si `assistantMessage.content` es un objeto, convertirlo en string
        const responseText = typeof assistantMessage.content === 'object' 
            ? JSON.stringify(assistantMessage.content) 
            : assistantMessage.content;

        console.log("✅ Respuesta recibida:", responseText);
        res.status(200).json({ response: responseText });

    } catch (error) {
        console.error("❌ Error inesperado en la API:", error);
        res.status(500).json({ error: "Error en la solicitud a OpenAI" });
    }
}
