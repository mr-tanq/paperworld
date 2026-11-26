import {createDelivery} from './delivery.mjs';
Deno.serve(createDelivery({environment:k=>Deno.env.get(k)}).handle);
