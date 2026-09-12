#include <bits/stdc++.h>
using namespace std;

using ll = long long;
using ld = long double;

#define endl '\n'
#define MOD 1000000007

void solve(){
    int n;
    cin >> n;
    string s;
    cin >> s;

    string st;
    for(char c : s){
        if(!st.empty() && st.back() == c)
            st.pop_back();
        else
            st.push_back(c);
    }
    cout << (st.empty() ? "YES" : "NO");
}

int main()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    cin >> t;

    while(t--){
        solve();
        cout << endl;
    }
    

    return 0;
}