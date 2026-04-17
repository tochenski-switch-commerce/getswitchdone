import { Resend } from 'resend';

async function run() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Lumio <notifications@mail.switchcommerce.team>',
      to: 'tochenski@switchcommerce.com',
      subject: 'Lumio Test Message',
      html: '<p>Direct send test from Lumio script.</p>',
    });

    if (error) {
      console.error('Error from Resend SDK:', error);
    } else {
      console.log('Email sent successfully. Response:', data);
    }
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

run();
