# Mathematical Foundations

## 1. STGCN Approximation
Given a highly restricted edge execution environment, the Spatio-Temporal Graph Convolution relies on mathematical approximations to bypass demanding historical recursion.
The spatial dependence is modeled fundamentally on the localized Chebyshev polynomial structure, heavily tuned for direct feed-forward linearity.
Formulaically, the predicted weight w' is estimated by a linear transformation over the adjacency convolution:
w' = sigmoid(Theta * X_t) where X represents spatial and temporal node vectors.

## 2. DQN Value Update Equation (Bellman)
The dynamic routing incorporates deep reinforcement concepts where the routing cost mirrors the negative Q-value.
The underlying optimal policy targets the maximization of expected cumulative return, adhering strictly to the optimal Bellman equation:
Q*(s, a) = E[R_(t+1) + gamma * max Q*(s', a') | S_t = s, A_t = a]
In VayuRoute Edge, the 'Reward' explicitly carries an inverse relationship to STGCN-predicted flood probability P(flood), defined as:
R = -k * P(flood) - alpha * Time Cost.
