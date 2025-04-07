const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const dotenv = require("dotenv");
const { v2: cloudinary } = require("cloudinary");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require('path');
const logo = '/images/logo.png';
dotenv.config();

const PORT = 5000;
// ⚠️ USANDO dotenv----------------------------------------------------
const SECRET =  process.env.CLAVESECRET;  
const DBMongoo = process.env.MONGODB_URI;
const cloudinaryName = process.env.cloudinaryName;
const cloudinaryKey = process.env.cloudinaryKey;
const cloudinarySecret = process.env.cloudinarySecret;
const MailPass = process.env.MailPass;
// Configuración Cloudinary
cloudinary.config({
  cloud_name: cloudinaryName,
  api_key: cloudinaryKey,
  api_secret: cloudinarySecret,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Conexión MongoDB
mongoose
  .connect(
    DBMongoo,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err));

// ─── MODELOS ───────────────────────────────────────────────────────

const EventoSchema = new mongoose.Schema({
  title: String,
  provider: String,
  date: String,
  imagePath: String, // URL de Cloudinary
  price: Number,
  category: String,
});
const Evento = mongoose.model("Evento", EventoSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  admin: { type: Boolean, default: false },
});
const User = mongoose.model("User", userSchema);

// MODELO ACTUALIZADO
const resetTokenSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true }, // Ahora se llama "code"
  expiresAt: { type: Date, required: true },
});
const ResetToken = mongoose.model("ResetToken", resetTokenSchema);

// SOLICITUD DE CÓDIGO DE RECUPERACIÓN
app.post("/reset-password-request", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Correo no encontrado" });

    // Generar código de 4 dígitos
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutos

    // Eliminar códigos anteriores del mismo email
    await ResetToken.findOneAndDelete({ email });

    // Guardar nuevo código
    await new ResetToken({ email, code, expiresAt }).save();

    // Enviar email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "devprueba.2022@gmail.com",
        pass: MailPass,
      },
    });

    const mailOptions = {
      from: `"Mi Entrada Ya" <devprueba.2022@gmail.com>`,
      to: email,
      subject: "Código de restablecimiento de contraseña",
      html: `
        <div style="max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
          <div style="text-align: center;">
            <img src="/images/logo.png" alt="Logo Mi Entrada Ya" style="width: 120px; margin-bottom: 20px;" />
            <h2 style="color: #4caf50;">Restablecimiento de Contraseña</h2>
          </div>
          <p>Hola,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Usá el siguiente código (válido por 15 minutos):</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; color: #333; background-color: #e0f7fa; padding: 10px 20px; border-radius: 8px; letter-spacing: 3px; display: inline-block;">
              ${code}
            </span>
          </div>
          <p>Si no solicitaste este código, ignorá este mensaje.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #999;">© ${new Date().getFullYear()} Mi Entrada Ya</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "📩 Código enviado. Revisá tu correo." });
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    res.status(500).json({ message: "❌ Error al enviar el código" });
  }
});

// ─── MULTER CONFIG ─────────────────────────────────────────────────

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ─── RUTAS DE EVENTOS ──────────────────────────────────────────────

app.get("/eventos", async (req, res) => {
  const eventos = await Evento.find();
  res.json(eventos);
});

app.post("/eventos", upload.single("image"), async (req, res) => {
  try {
    const { title, provider, date, price, category } = req.body;

    let imageUrl = "";
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "eventos" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          })
          .end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const nuevoEvento = new Evento({
      title,
      provider,
      date,
      price,
      category,
      imagePath: imageUrl,
    });
    await nuevoEvento.save();

    res.status(200).json({ message: "Evento guardado", url: imageUrl });
  } catch (error) {
    console.error("❌ Error subiendo evento:", error);
    res.status(500).json({ message: "Error subiendo evento" });
  }
});

app.delete("/api/eventos/:id", async (req, res) => {
  try {
    await Evento.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Evento eliminado" });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar el evento" });
  }
});

app.put("/eventos/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, provider, date, price, category } = req.body;
    const evento = await Evento.findById(req.params.id);
    if (!evento)
      return res.status(404).json({ message: "Evento no encontrado" });

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "eventos" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          })
          .end(req.file.buffer);
      });
      evento.imagePath = result.secure_url;
    }

    evento.title = title;
    evento.provider = provider;
    evento.date = date;
    evento.price = price;
    evento.category = category;

    await evento.save();
    res.status(200).json({ message: "Evento actualizado correctamente" });
  } catch (error) {
    console.error("Error actualizando evento:", error);
    res.status(500).json({ message: "Error actualizando el evento" });
  }
});

// ─── RUTAS DE USUARIOS ─────────────────────────────────────────────

app.post("/reset-password", async (req, res) => {
  const { email, token, password } = req.body;

  try {
    const resetToken = await ResetToken.findOne({ email, code: token });

    if (!resetToken) {
      return res
        .status(400)
        .json({ message: "Código inválido o ya utilizado." });
    }

    if (resetToken.expiresAt < new Date()) {
      await ResetToken.deleteOne({ email }); // Limpieza
      return res
        .status(400)
        .json({ message: "El código ha expirado. Solicitá uno nuevo." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    await ResetToken.deleteOne({ email }); // Eliminamos el token usado

    res
      .status(200)
      .json({ message: "✅ Contraseña restablecida exitosamente." });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error);
    res.status(500).json({ message: "❌ Error interno del servidor." });
  }
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "El usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Usuario no encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET, {
      expiresIn: "2h",
    });

    res.status(200).json({
      message: "Login exitoso desde Backend",
      token,
      user: {
        email: user.email,
        admin: user.admin,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ─── INICIAR SERVIDOR ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
}); //
