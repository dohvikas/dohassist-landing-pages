export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // Honeypot spam protection — if this hidden field has any value, it's a bot
    const honeypot = body.website_url;
    if (honeypot) {
      return res.status(200).json({
        success: true,
        message: "Thank you, we'll be in touch shortly.",
      });
    }

    // Timing check — reject if form submitted in under 3 seconds (bot speed)
    const renderedAt = parseInt(body.form_rendered_at, 10);
    if (renderedAt) {
      const elapsed = Date.now() - renderedAt;
      if (elapsed < 3000) {
        return res.status(200).json({
          success: true,
          message: "Thank you, we'll be in touch shortly.",
        });
      }
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      business_name,
      business_type,
      num_locations,
      contact_method,
      best_time,
      landing_page,
    } = body;

    // Validation
    if (!first_name || !first_name.trim()) {
      return res.status(400).json({ success: false, error: "First name is required" });
    }
    if (!last_name || !last_name.trim()) {
      return res.status(400).json({ success: false, error: "Last name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: "Invalid email format" });
    }

    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 10 || parseInt(digits[0]) < 2) {
        return res.status(400).json({ success: false, error: "Please enter a valid 10-digit US phone number" });
      }
    }

    if (!business_name || !business_name.trim()) {
      return res.status(400).json({ success: false, error: "Business name is required" });
    }

    // Build description from qualifying fields
    const descParts = [];
    if (num_locations) descParts.push(`Locations: ${num_locations}`);
    if (contact_method) descParts.push(`Contact via: ${contact_method}`);
    if (best_time) descParts.push(`Best time: ${best_time}`);
    if (landing_page) descParts.push(`Source page: ${landing_page}`);

    // Capture UTM params if present
    const utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const utmParts = [];
    for (const field of utmFields) {
      if (body[field]) utmParts.push(`${field}: ${body[field]}`);
    }
    if (utmParts.length > 0) descParts.push(`\n--- UTM ---\n${utmParts.join('\n')}`);

    const description = descParts.join("\n");

    // Build Web-to-Lead form params (same Zoho org as DohRx)
    const params = new URLSearchParams({
      xnQsjsdp: "941d8efc16780ea6427c54ab044bc9d1f59c33f838bbe389454fa3b1a967bc17",
      xmIwtLD: "ca2d7416814e7f433b84835405e7fac3532ca7529cd119a3cd40bf5030c3c955c0102c79c0dc8823585952331a80ce16",
      actionType: "TGVhZHM=",
      zc_gad: "",
      "aG9uZXlwb3Q": "",
      "Last Name": last_name.trim(),
      "First Name": first_name.trim(),
      "Email": email.trim(),
      "Phone": phone || "",
      "Company": business_name.trim(),
      "Industry": business_type || "",
      "Description": description,
      "Lead Source": "Advertisement",
    });

    const zohoRes = await fetch("https://crm.zoho.com/crm/WebToLeadForm", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      redirect: "manual",
    });

    // Zoho returns a 3xx redirect on success
    if (zohoRes.status >= 200 && zohoRes.status < 400) {
      return res.status(200).json({
        success: true,
        message: "Thank you, we'll be in touch shortly.",
      });
    }

    console.error("Zoho WebToLead error: status", zohoRes.status);
    return res.status(500).json({ success: false, error: "Submission failed" });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
