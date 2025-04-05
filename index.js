
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
// const dotenv = require("dotenv");
const { v2: cloudinary } = require("cloudinary");

// dotenv.config();

const PORT = 5000;
const SECRET = "claveSuperSecreta123"; // ⚠️ Usá dotenv en producción

// Configuración Cloudinary
cloudinary.config({
  cloud_name: 'dpys1cl9z',
  api_key: '163149469231334',
  api_secret: '_lhw0-QOrtTRQj6rGVW79qtxbbc',
});

// Middleware
app.use(cors());
app.use(express.json());

// Conexión MongoDB
mongoose.connect("mongodb+srv://ala282016:Gali282016*@cluster0.8xzv1tn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Conectado a MongoDB"))
.catch(err => console.error("❌ Error conectando a MongoDB:", err));

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

// ─── MULTER CONFIG ─────────────────────────────────────────────────

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ─── RUTAS DE EVENTOS ──────────────────────────────────────────────

app.get("/api/eventos", async (req, res) => {
  const eventos = await Evento.find();
  res.json(eventos);
});

app.post("/api/eventos", upload.single("image"), async (req, res) => {
  try {
    const { title, provider, date, price, category } = req.body;

    let imageUrl = "";
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "eventos" }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const nuevoEvento = new Evento({ title, provider, date, price, category, imagePath: imageUrl });
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

app.put("/api/eventos/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, provider, date, price, category } = req.body;
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: "Evento no encontrado" });

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "eventos" }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(req.file.buffer);
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

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "El usuario ya existe" });

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
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET, { expiresIn: "2h" });

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
});//
