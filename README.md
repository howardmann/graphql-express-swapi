# GraphQL Express App Example with Star Wars API

## Objective
Map Star Wars API REST Server to a GraphQL Express server

## Problem with REST API
We want to fetch the name of a planet and the associated names of its residents/people using the REST API. We are expecting the following data:
```json
{
  "data": {
    "planet": {
      "name": "Tatooine",
      "residents": [
        {"name": "Luke Skywalker"},
        {"name": "C-3PO"},
        {"name": "Darth Vader"},
        {"name": "Owen Lars"},
        {"name": "Beru Whitesun lars"},
        {"name": "R5-D4"},
        {"name": "Biggs Darklighter"},
        {"name": "Anakin Skywalker"},
        {"name": "Shmi Skywalker"},
        {"name": "Cliegg Lars"}
      ]
    }
  }
}
```
To do this using REST API we need to perform the following steps:
1. Fetch all details for a planet and pick the name and associated resident/people identifiers 
2. Fetch all associated people endpoints and pick the name
3. Combine all results together and return one object

First we would need to fetch the planet details:
`GET https://swapi.dev/api/planets/1`

This returns all the properties of the planet and all the associated resident url/ids.
```json
{
    "name": "Tatooine", 
    "rotation_period": "23", 
    "orbital_period": "304", 
    "diameter": "10465", 
    "climate": "arid", 
    "gravity": "1 standard", 
    "terrain": "desert", 
    "surface_water": "1", 
    "population": "200000", 
    "residents": [
        "https://swapi.dev/api/people/1/", 
        "https://swapi.dev/api/people/2/", 
        "https://swapi.dev/api/people/4/", 
        "https://swapi.dev/api/people/6/", 
        "https://swapi.dev/api/people/7/", 
        "https://swapi.dev/api/people/8/", 
        "https://swapi.dev/api/people/9/", 
        "https://swapi.dev/api/people/11/", 
        "https://swapi.dev/api/people/43/", 
        "https://swapi.dev/api/people/62/"
    ], 
```
Next we would need to fetch each of the 10 people via the people REST endpoint returning all the details of the person.
`GET https://swapi.dev/api/people/1/`

```json
{
    "name": "Luke Skywalker", 
    "height": "172", 
    "mass": "77", 
    "hair_color": "blond", 
    "skin_color": "fair", 
    "eye_color": "blue", 
    "birth_year": "19BBY", 
    "gender": "male", 
    "homeworld": "https://swapi.dev/api/planets/1/" 
}
```

This explains the N+1 select problem where we must send as many API query requests as there are resources.

## GraphQL Solution
GraphQL offers a solution to this N+1 select problem by joining all queries on the server side and returning a single combined result with only the properties and associations requested. This reduces the number of client-side requests and size of payload being sent to the client.

A similar GraphQL query would look as follows:
```graphql
{
  planet(id:1){
    name
    residents{
      name
    }
	}
}
```

and returns the following response:
```json
{
  "data": {
    "planet": {
      "name": "Tatooine",
      "residents": [
        {"name": "Luke Skywalker"},
        {"name": "C-3PO"},
        {"name": "Darth Vader"},
        {"name": "Owen Lars"},
        {"name": "Beru Whitesun lars"},
        {"name": "R5-D4"},
        {"name": "Biggs Darklighter"},
        {"name": "Anakin Skywalker"},
        {"name": "Shmi Skywalker"},
        {"name": "Cliegg Lars"}
      ]
    }
  }
}
```

## Example code
Here is an example of how to extend the Star Wars API to a GraphQL server using express.js.

```javascript
const express = require('express')
const {graphqlHTTP} = require('express-graphql')
const {buildSchema} = require('graphql')
const axios = require('axios')

// SWAPI REST API endpoints
const URL = {
  planets: 'https://swapi.dev/api/planets',
  people: 'https://swapi.dev/api/people',
  starships: 'https://swapi.dev/api/starships'
}

// GraphQL schema
// type <Resource>: resources and properties we want to expose via GraphQL including their relatonships
// type <Query>: query params and dynamic properties passed to access Resource
const schema = buildSchema(`
  type Planet {
    name: String, 
    diameter: String, 
    climate: String, 
    terrain: String,
    residents: [Person]
  }

  type Person {
    name: String,
    gender: String,
    homeworld: Planet
  }

  type Query {
    planet(id: ID!): Planet
    allPlanets: [Planet]
    person(id: ID!): Person
  }
`)

// GraphQL root resolver
// type <Query> properties map to root object passing in dyanmic properties and resolves to type <Resource>
const root = {
  planet: async ({id}) => {
    const response = await axios.get(`${URL.planets}/${id}`)
    const data = response.data
    return {
      name: data.name,
      diameter: data.diameter,
      climate: data.climate,
      terrain: data.terrain,
      residents: fetchResources(data.residents, "Person")
    }
  },
  // fetch allPlanets and associated residents and map them to Person schema
  allPlanets: async () => {
    const response = await axios.get(URL.planets)
    const data = response.data.results
    const planets = await Promise.all(data.map(async (planet) => {
      const residents = await fetchResources(planet.residents, 'Person')
      return {
        name: planet.name,
        diameter: planet.diameter,
        climate: planet.climate,
        terrain: planet.terrain,
        residents
      }
    }))
    return planets
  },  
  person: async ({id}) => {
    const response = await axios.get(`${URL.people}/${id}`)
    const data = response.data
    return {
      name: data.name,
      gender: data.gender,
      homeworld: fetchResource(data.homeworld, "Planet")
    }
  }
}

// Helper function when we need to fetch a related resource
// fetch url and return response and add a __typename property which is used by some GraphQL clients like Apollo
const fetchResource = async (url, type) => {
  const response = await axios.get(url)
  const data = response.data
  return {
    ...data,
    __typename: type
  }
}

// Same but for an array of urls
const fetchResources = async (urls, type) => {
  const responses = await Promise.all(urls.map((url) => axios.get(url)))
  const data = responses.map((response) => response.data)
  const result = data.map((item) => ({
    ...item,
    __typename: type
  }))
  return result
}

const app = express()

// express middleware to use graphql endpoint, passing in properties of the buildSchema, root resolver and enable grahiql client
app.use('/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true
  })
)

app.listen(3000, () => {
  console.log('Running a GraphQL API server at localhost:3000/graphql');
})
```