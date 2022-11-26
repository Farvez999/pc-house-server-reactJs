const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

// middle wares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mordayw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        const usersCollection = client.db("used-products-resale-portal").collection("users");
        const categoriesCollection = client.db("used-products-resale-portal").collection("categories");
        const productsCollection = client.db("used-products-resale-portal").collection("products");
        const bookingsCollection = client.db("used-products-resale-portal").collection("bookings");

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // JWT
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '24h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        //All category
        app.get('/categories', async (req, res) => {
            const query = {};
            const cursors = categoriesCollection.find(query)
            const categorie = await cursors.toArray()
            res.send(categorie)
        })

        app.get('/categorie/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const categorie = await categoriesCollection.findOne(query)
            res.send(categorie)
        })

        app.get('/categories/:name', async (req, res) => {
            const name = req.params.name;
            const query = {
                category: name
            }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })

        //All product get
        app.get('/products', async (req, res) => {
            const query = {};
            const result = await productsCollection.find(query).toArray()
            res.send(result);
        });

        // app.get('/products/:name', async (req, res) => {
        //     const name = req.params.name;
        //     const query = {
        //         categories_name: name
        //     }
        //     const result = await productsCollection.find(query).toArray()
        //     res.send(result)
        // })

        app.post('/addProduct', verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        // Seller delete
        app.delete('/products/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })



        //All User 
        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })

        //All User
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const users = await usersCollection.findOne(query)
            res.send(users)
        })

        //User post
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/allUser/:role', async (req, res) => {
            const role = req.params.role;
            const query = { role: role };
            const users = await usersCollection.find(query).toArray()
            res.send(users);
        })

        // User get Admin permistion
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        //User get Seller permistion
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'Seller' });
        })



        // Update user role Admin
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })


        // Buyer delete
        app.delete('/buyers/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // Seller delete
        app.delete('/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })



        //get bookings
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;

            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            // console.log('token', req.headers.authorization)

            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

        // bookings post (submit data)
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking)

            // const query = {
            //     appointmentDate: booking.appointmentDate,
            //     email: booking.email,
            //     treatment: booking.treatment

            // }

            // const alreadyBooked = await bookingsCollection.find(query).toArray();

            // if (alreadyBooked.length) {
            //     const message = `You have already Booking on ${booking.appointmentDate}`
            //     return res.send({ acknowledged: false, message });
            // }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result);
        })


    } finally {
        //   await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('used-products-resale is Running')
})

app.listen(port, () => {
    console.log(`used-products-resale running on Server ${port}`);
})