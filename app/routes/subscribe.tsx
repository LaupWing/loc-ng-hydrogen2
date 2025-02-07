import { json, type ActionFunctionArgs } from "@netlify/remix-runtime"

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
        })
    }

    try {
        const { email } = (await request.json()) as any
        if (!email) {
            return new Response(
                JSON.stringify({ error: "Email is required" }),
                { status: 400 }
            )
        }

        console.log("Subscribing email:", email)

        // Shopify Admin API URL
        const ADMIN_API_URL = `https://${process.env.PUBLIC_STORE_DOMAIN}/admin/api/2023-01/customers.json`

        // Send request to Shopify API
        const shopifyResponse = await fetch(ADMIN_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token":
                    process.env.PRIVATE_STOREFRONT_API_TOKEN!,
            },
            body: JSON.stringify({
                customer: {
                    email: email,
                    accepts_marketing: true, // Subscribing to marketing emails
                },
            }),
        })

        const shopifyData: any = await shopifyResponse.json()

        if (!shopifyResponse.ok) {
            return json(
                {
                    error: shopifyData.errors || "Shopify subscription failed",
                },
                { status: shopifyResponse.status }
            )
        }

        console.log("Shopify subscription successful:", shopifyData)

        // Send request to Beehiiv API
        const beehiivResponse = await fetch(
            "https://api.beehiiv.com/v2/publications/pub_933eff84-523b-4a44-8fc1-2c0166fa0fd8/subscriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email }),
            }
        )

        const beehiivData = (await beehiivResponse.json()) as any

        if (!beehiivResponse.ok) {
            return new Response(
                JSON.stringify({
                    error: beehiivData.error || "Beehiiv subscription failed",
                }),
                {
                    status: beehiivResponse.status,
                }
            )
        }

        console.log("Beehiiv subscription successful:", beehiivData)

        // Return success if both API calls were successful
        return json({ success: true, shopifyData, beehiivData })
    } catch (error: any) {
        console.error("Error in subscription:", error.message)
        return json({ error: error.message }, { status: 500 })
    }
}
