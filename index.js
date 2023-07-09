const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

//  Verify JWT Token
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// mongodb
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.57whvd4.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-yzchwmg-shard-00-00.57whvd4.mongodb.net:27017,ac-yzchwmg-shard-00-01.57whvd4.mongodb.net:27017,ac-yzchwmg-shard-00-02.57whvd4.mongodb.net:27017/?ssl=true&replicaSet=atlas-gd2qrc-shard-0&authSource=admin&retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Data Collections ==>
const productCollection = client
  .db("FitLifeNow")
  .collection("productCollection");
const usersCollection = client.db("FitLifeNow").collection("usersCollection");
const cartCollection = client.db("FitLifeNow").collection("cartCollection");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    // JWT Token API
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Verify Admin API
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // Products APIs ==>
    // Get API of All Product
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    //  Get API of Best Products
    app.get("/products/best", async (req, res) => {
      const query = { isBest: true };
      const options = {
        sort: { price: 1 },
      };
      const result = await productCollection.find(query, options).toArray();
      res.send(result);
    });

    // Get API of Individual Product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(filter);
      res.send(result);
    });

    // Post API for add products
    app.post("/products", verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await productCollection.insertOne(newItem);
      res.send(result);
    });

    // All Users APIs ==>
    // Get API for All Users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //  Get API of Admin Users Role
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Post API of Users Details
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Patch API for User Data Update Role as Admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateUser);
      res.send(result);
    });

    // All Cart APIs
    // Get API for All Cart Data
    app.get("/carts/all", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const result = await cartCollection.find().toArray();
      res.send(result);
    });

    // Get API for Cart Data
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // Post API of Cart Data
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const id = req.body.product_id;
      const query = { product_id: id };
      const existingCart = await cartCollection.findOne(query);
      if (existingCart) {
        return res.send({ message: "cart already exists" });
      }
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    // Patch API for Cart Status as Admin
    app.patch("/delivered/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          status: "Delivered",
        },
      };
      const result = await cartCollection.updateOne(filter, updateUser);
      res.send(result);
    });

    // Delete API for Cart Data
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Fit Life Now Server is Running!");
});

app.listen(port, () => {
  console.log(`Fit Life Now listening on port ${port}`);
});
