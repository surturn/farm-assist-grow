import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, ShoppingBag, MapPin, Search, Star, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/client";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
}

interface Agrovet {
  id: string;
  name: string;
  location: string;
  contactNumber: string;
  rating: number;
  products?: Product[];
}

export default function AgrovetMarketplace() {
  const [agrovets, setAgrovets] = useState<Agrovet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ordering, setOrdering] = useState<string | null>(null);

  useEffect(() => {
    fetchAgrovets();
  }, []);

  const fetchAgrovets = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/agrovets');
      setAgrovets(data || []);
    } catch (error) {
      console.error("Failed to fetch agrovets", error);
      // Fallback Mock Data for UI demonstration
      setAgrovets([
        {
          id: '1', name: 'Mkulima Bora Agrovet', location: 'Nairobi Central', contactNumber: '+254711223344', rating: 4.8,
          products: [
            { id: 'p1', name: 'NPK Fertilizer 50kg', category: 'Fertilizer', price: 3500, inStock: true },
            { id: 'p2', name: 'Dudu Dust 500g', category: 'Pesticide', price: 450, inStock: true }
          ]
        },
        {
          id: '2', name: 'Green Harvest Supplies', location: 'Nakuru Town', contactNumber: '+254722334455', rating: 4.5,
          products: [
            { id: 'p3', name: 'Tomato Seeds (Hybrid)', category: 'Seeds', price: 1200, inStock: true },
            { id: 'p4', name: 'Fungicide Pro', category: 'Fungicide', price: 850, inStock: false }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = (productId: string, productName: string, agrovetName: string) => {
    setOrdering(productId);
    // Simulate order placement
    setTimeout(() => {
      setOrdering(null);
      toast.success(`Ordered ${productName}`, {
        description: `Your order from ${agrovetName} has been placed. They will contact you shortly.`
      });
    }, 1500);
  };

  const filteredAgrovets = agrovets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.products?.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-orange-900 flex items-center gap-2">
              <Store className="h-8 w-8 text-orange-600" />
              Agrovet Marketplace
            </h1>
            <p className="text-orange-800 mt-1">Find nearest agrovets, browse available supplies, and order directly.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products or locations..." 
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-orange-600" /></div>
        ) : filteredAgrovets.length === 0 ? (
          <div className="text-center p-12 bg-muted/30 rounded-xl border-dashed border-2">
            <Store className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">No agrovets or products found matching your search.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredAgrovets.map((agrovet) => (
              <Card key={agrovet.id} className="overflow-hidden border-orange-100">
                <CardHeader className="bg-orange-50/50 pb-4 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl text-orange-950 flex items-center gap-2">
                        {agrovet.name}
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                          <Star className="h-3 w-3 mr-1 fill-orange-500 text-orange-500" /> {agrovet.rating}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {agrovet.location}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {agrovet.contactNumber}</span>
                      </CardDescription>
                    </div>
                    <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
                      Contact Agrovet
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-orange-100">
                    {agrovet.products?.map((product) => (
                      <div key={product.id} className="p-6 flex flex-col justify-between hover:bg-orange-50/30 transition-colors">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline" className="text-xs">{product.category}</Badge>
                            {product.inStock ? (
                              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 text-xs border-transparent">In Stock</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Out of Stock</Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-lg leading-tight mb-1">{product.name}</h4>
                          <p className="text-2xl font-bold text-orange-700 mb-4">KES {product.price}</p>
                        </div>
                        <Button 
                          className="w-full bg-orange-600 hover:bg-orange-700" 
                          disabled={!product.inStock || ordering === product.id}
                          onClick={() => handleOrder(product.id, product.name, agrovet.name)}
                        >
                          {ordering === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><ShoppingBag className="h-4 w-4 mr-2" /> Order Now</>
                          )}
                        </Button>
                      </div>
                    ))}
                    {(!agrovet.products || agrovet.products.length === 0) && (
                      <div className="p-8 text-center text-muted-foreground col-span-full">
                        No products currently listed.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
