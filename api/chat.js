export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { message } = req.body;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // ⏳ Esperar hasta 30s

        // Crear un nuevo Thread (hilo)
        const threadResponse = await fetch("https://api.openai.com/v1/threads", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            signal: controller.signal // 🔹 Permite cancelar la solicitud si se tarda demasiado
        });

        clearTimeout(timeoutId); // ✅ Cancelar el temporizador si la API responde a tiempo

        const threadData = await threadResponse.json();
        if (!threadResponse.ok) {
            throw new Error(`Error al crear el hilo: ${JSON.stringify(threadData)}`);
        }

        const threadId = threadData.id;

        // Agregar el mensaje del usuario
        await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({ role: "user", content: message })
        });

        // Ejecutar el asistente
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({ assistant_id: process.env.OPENAI_ASSISTANT_ID })
        });

        const runData = await runResponse.json();
        if (!runResponse.ok) {
            throw new Error(`Error al ejecutar el asistente: ${JSON.stringify(runData)}`);
        }

        const runId = runData.id;
        let status = "in_progress";

        while (status === "in_progress" || status === "queued") {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Esperar 2 segundos
            const checkRunResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "OpenAI-Beta": "assistants=v2"
                }
            });

            const checkRunData = await checkRunResponse.json();
            if (!checkRunResponse.ok) {
                throw new Error(`Error al verificar el estado del asistente: ${JSON.stringify(checkRunData)}`);
            }

            status = checkRunData.status;
        }

        // Obtener respuesta del asistente
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "assistants=v2"
            }
        });

        const messagesData = await messagesResponse.json();
        if (!messagesResponse.ok) {
            throw new Error(`Error al obtener la respuesta: ${JSON.stringify(messagesData)}`);
        }

        const assistantMessage = messagesData.data.find((msg) => msg.role === "assistant");
        if (!assistantMessage) {
            console.error(" OpenAI no devolvió ninguna respuesta:", messagesData);
            return res.status(500).json({ response: "El asistente no proporcionó una respuesta." });
        }

        res.status(200).json({ response: assistantMessage.content });

    } catch (error) {
        console.error("Error en la API de OpenAI:", error);

        if (error.name === "AbortError") {
            res.status(504).json({ error: "Tiempo de espera agotado. Inténtalo de nuevo más tarde." });
        } else {
            res.status(500).json({ error: "Error en la solicitud a OpenAI" });
        }
    }
}
