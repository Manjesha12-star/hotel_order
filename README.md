# TableSide Order

Build a modern, premium Restaurant QR Ordering System for dine-in customers only.



PROJECT GOAL



The system is designed exclusively for customers dining inside the restaurant. Every table has a unique QR code. When a customer scans the QR code, the restaurant menu opens automatically with the correct table number detected. Customers can browse the menu, place orders, request a waiter, and request the bill.



There is NO:

- Delivery

- Takeaway

- Customer account creation

- Customer login



The application should be fast, responsive, secure, and easy to use on mobile devices.



====================================================

STAFF ROLE

====================================================



There is only one dashboard for restaurant staff.



Staff can:

- View incoming orders

- Accept orders

- Change order status

- View grouped orders by table

- View today's orders

- Handle waiter requests

- Handle bill requests

- Print customer bills

- View active tables

- Mark tables as completed after payment

- Reset tables for the next customers



Staff CANNOT:

- Add menu items

- Edit menu items

- Delete menu items

- Change prices

- Modify categories

- Upload food images

- Generate or edit QR codes

- Change restaurant settings

- Delete completed orders

- Access database settings



Menu management and restaurant configuration are handled directly in the database and are not available from the application dashboard.



====================================================

CUSTOMER FEATURES

====================================================



No login required.



When a customer scans a QR code:



Example:

restaurant.com/menu?table=1

restaurant.com/menu?table=12



The system automatically detects the table number.



Customers can:

- Browse the menu

- Search food

- Filter by category

- View food images

- View Veg/Non-Veg indicators

- View spice level

- View food descriptions

- View prices

- View availability

- Select quantity

- Add items to cart

- Remove items from cart

- Update quantities

- Add special instructions

- Place orders

- View live order status

- Request a waiter

- Request the bill



====================================================

MENU CATEGORIES

====================================================



- Starters

- Soups

- Main Course

- Rice

- Breads

- Chinese

- Desserts

- Ice Cream

- Beverages

- Combos

- Kids Menu



====================================================

FOOD ITEM DETAILS

====================================================



Each item includes:

- Image

- Name

- Description

- Price

- Category

- Veg/Non-Veg indicator

- Spice level

- Available/Out of Stock

- Popular badge

- Chef Special badge



====================================================

ORDER FLOW

====================================================



Customer Places Order



↓



Kitchen Receives Order



↓



Accepted



↓



Preparing



↓



Ready



↓



Served



====================================================

GROUP ORDERS BY TABLE NUMBER

====================================================



Orders must always be grouped by table number instead of creating separate cards for every order.



Example:



TABLE 5



Order #001

- Chicken Biryani ×2

- Coke ×2



Order #002

- Butter Naan ×4

- Paneer Butter Masala ×1



Display:



Table 5

Total Active Orders: 2

Running Bill: ₹XXXX



Whenever the same table places another order, append it under the existing Table 5 session.



Do not create a new table card.



Only close the table after payment is completed.



====================================================

KITCHEN / STAFF DASHBOARD

====================================================



Display one card per table.



Each table card shows:

- Table Number

- Current Status

- Number of Active Orders

- Time Since First Order

- Latest Order Time

- Running Bill

- All Orders

- Special Notes



Actions:

- Accept

- Preparing

- Ready

- Served

- Print Kitchen Order Ticket (KOT)

- Collapse/Expand Orders



Highlight newly added items.



Play a notification sound for every new order.



====================================================

WAITER REQUESTS

====================================================



Customer taps:

Call Waiter



Dashboard notification:

🔔 Table 8 needs assistance.



Staff actions:

- Accepted

- Completed



====================================================

BILL REQUEST

====================================================



Customer taps:

Request Bill



Dashboard notification:

💳 Bill Requested



Staff actions:

- Print Bill

- Paid

- Close Table

- Reset Table



====================================================

TABLE MANAGEMENT

====================================================



Display all tables with status:

- Available

- Occupied

- Bill Requested

- Cleaning

- Ready



====================================================

SEARCH & FILTERS

====================================================



Search by:

- Food Name

- Category



Filter by:

- Veg

- Non-Veg

- Available



====================================================

NOTIFICATIONS

====================================================



- New Order

- New Items Added

- Waiter Request

- Bill Request

- Order Ready

- Payment Completed



====================================================

REPORTS

====================================================



- Today's Orders

- Today's Revenue

- Active Tables

- Completed Orders

- Peak Hours

- Most Ordered Items



====================================================

DATABASE

====================================================



Create tables for:

- Restaurant Tables

- Categories

- Menu Items

- Orders

- Order Items

- Staff Users

- Waiter Requests

- Bill Requests

- Activity Logs



====================================================

ACTIVITY LOG

====================================================



Log every staff action with:

- Staff Name

- Action

- Table Number

- Order Number

- Date & Time



====================================================

DESIGN

====================================================



- Premium restaurant design

- Mobile-first interface

- Tablet-friendly kitchen dashboard

- Fast loading

- Smooth animations

- Responsive layout

- Modern typography

- High-quality food cards

- Large touch-friendly buttons

- Minimal clicks

- Professional user experience



====================================================

GOAL

====================================================



Build a production-ready QR restaurant ordering system where customers scan a QR code, order directly from their table, and all orders are automatically grouped under the same table until the bill is paid. Staff can only manage orders, waiter requests, and billing. Menu items, prices, categories, QR codes, and restaurant settings are intentionally not editable from the application and are managed directly through the database.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/30b9d0f6-b252-4ad0-8e46-fad31c3e1e91).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
