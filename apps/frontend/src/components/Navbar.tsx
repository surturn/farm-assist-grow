import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const ListItem = ({ className, title, children, href, ...props }: any) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          href={href}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-green-50 hover:text-green-900 focus:bg-green-50 focus:text-green-900",
            className
          )}
          {...props}
        >
          <div className="text-sm font-semibold leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-gray-500">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
};

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Leaf className="h-8 w-8 text-green-700" />
          <div className="flex flex-col">
            <span className="font-bold text-xl leading-none text-gray-900 tracking-tight">FarmAssist</span>
            <span className="text-xs font-semibold text-green-700 leading-none">Kenya</span>
          </div>
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-transparent text-gray-600 hover:text-green-700 font-medium text-sm">Platform</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <a
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-green-50 to-green-100 p-6 no-underline outline-none focus:shadow-md"
                          href="/"
                        >
                          <Leaf className="h-6 w-6 text-green-700 mb-2" />
                          <div className="mb-2 mt-4 text-lg font-bold text-green-900">
                            FarmAssist Core
                          </div>
                          <p className="text-sm leading-tight text-green-800">
                            The complete digital ecosystem for modern Kenyan farmers.
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <ListItem href="/dashboard" title="Dashboard">
                      Real-time analytics and farm management overview.
                    </ListItem>
                    <ListItem href="/crop-planner" title="Crop Planning">
                      AI-driven crop rotation and yield forecasting.
                    </ListItem>
                    <ListItem href="/scan" title="Disease AI Scan">
                      Instantly identify crop diseases using your camera.
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-transparent text-gray-600 hover:text-green-700 font-medium text-sm">Ecosystem</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <ListItem href="/agrovet" title="Agrovet Marketplace">
                      Order authentic seeds, fertilizers, and equipment.
                    </ListItem>
                    <ListItem href="/trees" title="Agroforestry">
                      Manage your timber and fruit tree investments.
                    </ListItem>
                    <ListItem href="/farms" title="Farm Mapping">
                      GPS coordinate tracking for your plots.
                    </ListItem>
                    <ListItem href="#offline" title="Offline Mode">
                      Full functionality even without internet access.
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="#pricing">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "bg-transparent hover:bg-transparent text-gray-600 hover:text-green-700 font-medium text-sm")}>
                    Pricing
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link to="#about">
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "bg-transparent hover:bg-transparent text-gray-600 hover:text-green-700 font-medium text-sm")}>
                    About Us
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button variant="outline" className="border-green-200 text-green-800 hover:bg-green-50">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-green-700 hover:bg-green-800 text-white shadow-sm">Start Free Trial</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
