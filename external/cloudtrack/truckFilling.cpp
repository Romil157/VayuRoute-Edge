#include <bits/stdc++.h>
using namespace std;

struct Box {
    int globalId;
    string customer;
    string customerId;
    int customerBoxNum;
    int weight;
};

struct Truck {
    vector<Box> boxes;
    int totalWeight = 0;
};

int getValidatedInt(const string& prompt) {
    int x;
    cout << prompt;
    while (!(cin >> x) || x <= 0) {
        cout << "Invalid input. Please enter a positive integer: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }
    return x;
}

vector<Truck> packBoxes(vector<Box>& allBoxes, int maxWeight, int maxBoxesPerTruck, int totalTrucks) {
    unordered_map<string, vector<Box>> groupedByCustomer;
    for (Box& box : allBoxes) {
        groupedByCustomer[box.customer].push_back(box);
    }

    vector<Truck> trucks;

    for (auto& [customer, boxes] : groupedByCustomer) {
        // Try to fit all boxes into one truck first
        int totalBoxes = boxes.size();
        int totalWeight = 0;
        for (Box& b : boxes) totalWeight += b.weight;

        bool assigned = false;

        // Try placing all boxes in a single existing truck
        for (Truck& t : trucks) {
            if ((int)t.boxes.size() + totalBoxes <= maxBoxesPerTruck &&
                t.totalWeight + totalWeight <= maxWeight) {
                t.boxes.insert(t.boxes.end(), boxes.begin(), boxes.end());
                t.totalWeight += totalWeight;
                assigned = true;
                break;
            }
        }

        // Try placing all boxes in a new truck
        if (!assigned && trucks.size() < totalTrucks &&
            totalBoxes <= maxBoxesPerTruck &&
            totalWeight <= maxWeight) {
            Truck newTruck;
            newTruck.boxes = boxes;
            newTruck.totalWeight = totalWeight;
            trucks.push_back(newTruck);
            assigned = true;
        }

        // If not possible, assign boxes individually like before
        if (!assigned) {
            sort(boxes.begin(), boxes.end(), [](Box& a, Box& b) {
                return a.weight > b.weight;
            });

            for (Box& box : boxes) {
                int bestIdx = -1;
                int minSlack = INT_MAX;

                for (int i = 0; i < (int)trucks.size(); ++i) {
                    Truck& t = trucks[i];
                    if ((int)t.boxes.size() < maxBoxesPerTruck &&
                        t.totalWeight + box.weight <= maxWeight) {
                        int slack = maxWeight - (t.totalWeight + box.weight);
                        if (slack < minSlack) {
                            minSlack = slack;
                            bestIdx = i;
                        }
                    }
                }

                if (bestIdx != -1) {
                    trucks[bestIdx].boxes.push_back(box);
                    trucks[bestIdx].totalWeight += box.weight;
                } else if ((int)trucks.size() < totalTrucks) {
                    Truck newTruck;
                    newTruck.boxes.push_back(box);
                    newTruck.totalWeight = box.weight;
                    trucks.push_back(newTruck);
                } else {
                    cout << "❌ Cannot assign box " << box.customer << " - Box " << box.customerBoxNum
                         << " (" << box.weight << "kg). All trucks full.\n";
                }
            }
        }
    }

    return trucks;
}


int main() {
    int numCustomers = getValidatedInt("Enter number of customers: ");
    int boxCounter = 1;
    vector<Box> allBoxes;
    unordered_map<string, int> customerBoxCounter;
    unordered_map<string, string> customerIds;

    for (int i = 0; i < numCustomers; ++i) {
        string name;
        cout << "Enter name of customer " << i + 1 << ": ";
        cin >> ws;
        
        getline(cin, name);

        string customerId = "c" + to_string(i + 1);
        customerIds[name] = customerId;

        int numBoxes = getValidatedInt("Enter number of boxes for " + name + ": ");
        for (int j = 0; j < numBoxes; ++j) {
            int weight = getValidatedInt("  Enter weight of box " + to_string(j + 1) + ": ");
            customerBoxCounter[name]++;
            allBoxes.push_back({boxCounter++, name, customerId, customerBoxCounter[name], weight});
        }
    }

    int maxWeight = getValidatedInt("\nEnter max weight per truck: ");
    int maxBoxesPerTruck = getValidatedInt("Enter max number of boxes per truck: ");
    int totalTrucks = getValidatedInt("Enter number of available trucks: ");

    auto result = packBoxes(allBoxes, maxWeight, maxBoxesPerTruck, totalTrucks);

    cout << "\n🚚 Truck Assignments:\n";
    for (int i = 0; i < result.size(); ++i) {
        cout << "Truck " << i + 1 << ":\n";
        for (Box& b : result[i].boxes) {
            cout << "  " << b.customer << " - Box " << b.customerBoxNum
                 << " - " << b.weight << "kg [" << b.customerId << "#b" << b.customerBoxNum << "]\n";
        }
        cout << "  Total Weight: " << result[i].totalWeight << "kg\n";
    }

    return 0;
}