export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { message } = req.body;

    try {
        const response = await fetch("https://api.openai.com/v1/threads", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: process.env.OPENAI_ASSISTANT_ID,  // Ahora usa la variable de entorno correcta
                messages: [{ role: "user", content: message }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Error en OpenAI: ${JSON.stringify(data)}`);
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Error en la API:", error);
        res.status(500).json({ error: "Error en la solicitud a OpenAI" });
    }
}
